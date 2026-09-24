#!/usr/bin/env python3
"""Run the local review/publish gate: python3 verify.py.

Requires Python 3 and Node.js, with no third-party packages or network access.
The build runs in a temporary directory and never rewrites the working copy.
Browser interaction, visual layout, and assistive-technology checks remain
separate: the HTML checks here validate static references, not accessibility.
"""
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
TESTS = (
    'surface-model.test.js',
    'surface-reference.test.js',
    'surface-confidence.test.js',
    'surface-edge.test.js',
    'surface-catalog.test.js',
)
# Keep this list aligned with the source files consumed by build_site.py.
# app.js and index.html are deliberately absent: the build must create them.
BUILD_INPUTS = (
    'build_site.py', 'source.html', 'details.html', 'surface.html',
    'site.css', 'surface.css', 'theme.js', 'model.js', 'extras.js',
    'surface-model.js', 'surface-confidence.js', 'surface-app.js',
    'surface-cases.json', 'surface-catalog.js', 'build_catalog.js',
)
GENERATED = ('app.js', 'index.html', 'catalog-reference.json')
# The router exposes #walkthrough as an alias for this real DOM element.
FRAGMENT_ALIASES = {'walkthrough': 'uf-decoder-lesson'}


class VerificationError(Exception):
    """A check failed with a message suitable for the command line."""


def run(command: list[str], cwd: Path = ROOT) -> str:
    """Capture child output so successful syntax/build checks stay quiet."""
    try:
        result = subprocess.run(
            command, cwd=cwd, text=True, encoding='utf-8',
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise VerificationError(f'Could not finish {Path(command[-1]).name}: {error}') from error
    if result.returncode:
        detail = '\n'.join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        raise VerificationError(f'{Path(command[-1]).name} exited with {result.returncode}.\n{detail}')
    return result.stdout.strip()


class StaticReferences(HTMLParser):
    """Collect real HTML IDs/references; script text is not parsed as markup."""

    ARIA_IDREFS = {
        'aria-labelledby', 'aria-describedby', 'aria-controls',
        'aria-owns', 'aria-flowto', 'aria-activedescendant',
        'aria-details', 'aria-errormessage',
    }
    LABELABLE = {'button', 'input', 'meter', 'output', 'progress', 'select', 'textarea'}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: dict[str, tuple[str, dict[str, str | None]]] = {}
        self.references: list[tuple[str, str, int]] = []
        self.labels: list[tuple[str, int]] = []
        self.issues: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        line = self.getpos()[0]
        if Counter(name for name, _ in attrs)['id'] > 1:
            self.issues.append(f'line {line}: repeated id attribute on <{tag}>')
        identifier = attributes.get('id')
        if identifier is not None:
            if not identifier or any(character.isspace() for character in identifier):
                self.issues.append(f'line {line}: empty ID or whitespace in ID {identifier!r}')
            elif identifier in self.ids:
                self.issues.append(f'line {line}: duplicate ID {identifier!r}')
            else:
                self.ids[identifier] = (tag, attributes)
        if tag == 'label' and attributes.get('for'):
            target = attributes['for']
            self.references.append(('label for', target, line))
            self.labels.append((target, line))
        for attribute in self.ARIA_IDREFS:
            for target in (attributes.get(attribute) or '').split():
                self.references.append((attribute, target, line))
        href = attributes.get('href')
        if tag in {'a', 'area'} and href:
            url = urlsplit(href)
            if not url.scheme and not url.netloc and url.path in {'', 'index.html', './index.html'} and url.fragment:
                target = unquote(url.fragment)
                self.references.append(('local fragment', FRAGMENT_ALIASES.get(target, target), line))

    def validate(self) -> None:
        for kind, target, line in self.references:
            if target not in self.ids:
                self.issues.append(f'line {line}: {kind} points to missing ID {target!r}')
        for target, line in self.labels:
            element = self.ids.get(target)
            if element:
                tag, attrs = element
                if tag not in self.LABELABLE or (tag == 'input' and (attrs.get('type') or '').lower() == 'hidden'):
                    self.issues.append(f'line {line}: label points to non-labelable element {target!r}')
        if self.issues:
            raise VerificationError('Static index.html references failed:\n' + '\n'.join(f'  {issue}' for issue in self.issues))


def check_build() -> None:
    """Regenerate from copied source inputs, then compare exact output bytes."""
    missing = [name for name in (*BUILD_INPUTS, *GENERATED) if not ROOT.joinpath(name).is_file()]
    if missing:
        raise VerificationError('Missing build files: ' + ', '.join(missing))
    with tempfile.TemporaryDirectory(prefix='decoder-lab-verify-') as temporary:
        work = Path(temporary)
        for name in BUILD_INPUTS:
            shutil.copyfile(ROOT / name, work / name)
        run([sys.executable, 'build_site.py'], cwd=work)
        stale = [name for name in GENERATED if not work.joinpath(name).is_file() or work.joinpath(name).read_bytes() != ROOT.joinpath(name).read_bytes()]
        if stale:
            raise VerificationError(
                'Generated files do not match their source inputs: ' + ', '.join(stale)
                + '\nRun python3 build_site.py, review the generated changes, then rerun python3 verify.py.'
            )
        print('PASS build reproducibility: app.js, index.html, and catalog-reference.json match byte for byte.')
        document = StaticReferences()
        document.feed(work.joinpath('index.html').read_text(encoding='utf-8'))
        document.close()
        document.validate()
        print(f'PASS static HTML references: {len(document.ids)} unique IDs and {len(document.references)} label, ARIA, and local-fragment references.')


def main() -> int:
    node = shutil.which('node')
    if node is None:
        print('FAIL: Node.js is required to check and execute the JavaScript models.', file=sys.stderr)
        return 1
    try:
        sources = sorted(ROOT.glob('*.js'))
        if not sources:
            raise VerificationError('No root JavaScript sources found.')
        for source in sources:
            run([node, '--check', source.name])
        print(f'PASS JavaScript syntax: {len(sources)} root files.')
        for name in TESTS:
            if not ROOT.joinpath(name).is_file():
                raise VerificationError(f'Missing required test: {name}')
            print(run([node, name]) or f'PASS {name}')
        check_build()
    except VerificationError as error:
        print(f'FAIL: {error}', file=sys.stderr)
        return 1
    print('Verification passed. Browser and visual checks are separate.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
