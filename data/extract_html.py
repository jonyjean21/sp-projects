#!/usr/bin/env python3
import sys
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip_tags = {'style', 'script'}
        self.current_skip = False
        self.skip_depth = 0
    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.current_skip = True
            self.skip_depth += 1
        if tag in ('h1','h2','h3','p','li','td','th','summary','div','br','hr'):
            self.text.append('\n')
    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip_depth -= 1
            if self.skip_depth <= 0:
                self.current_skip = False
                self.skip_depth = 0
    def handle_data(self, data):
        if not self.current_skip:
            self.text.append(data.strip())

with open(sys.argv[1], 'r') as f:
    content = f.read()

parser = TextExtractor()
parser.feed(content)
result = '\n'.join(line for line in ''.join(parser.text).split('\n') if line.strip())
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
print(result[:limit])
