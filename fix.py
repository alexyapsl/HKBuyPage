import re

with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

# Fix 1: Change invalid function declaration to proper assignment
h = h.replace('function window.renderColorChips(storageOpt)', 'window.renderColorChips = function(storageOpt)')

# Fix 2: Remove external color-chips.js include
h = h.replace('<script src="color-chips.js"></script>', '<!-- color-chips.js removed: inline only -->')

# Fix 3: Ensure init() is called on page load
if 'init();' not in h and 'addEventListener' not in h.split('</body>')[0]:
    h = h.replace('</body>', '    <script>window.addEventListener("load", init);</script>\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

print('All fixes applied cleanly')