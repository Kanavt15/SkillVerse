import os
import re

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Backgrounds
    content = re.sub(r'bg-\[#0a0e1a\]', 'bg-background', content)
    content = re.sub(r'bg-\[#0f1629\]', 'bg-background', content)
    content = re.sub(r'bg-\[#111827\]', 'bg-background', content)
    content = re.sub(r'bg-white/\[?[0-9.]+\]?', 'bg-card', content)
    
    # Texts
    content = re.sub(r'text-white', 'text-foreground', content)
    content = re.sub(r'text-slate-200', 'text-muted-foreground', content)
    content = re.sub(r'text-slate-300', 'text-muted-foreground', content)
    content = re.sub(r'text-slate-400', 'text-muted-foreground', content)
    content = re.sub(r'text-slate-500', 'text-muted-foreground', content)
    content = re.sub(r'text-slate-600', 'text-muted-foreground', content)
    
    # Borders
    content = re.sub(r'border-white/\[?[0-9.]+\]?', 'border-border', content)
    content = re.sub(r'border-slate-800', 'border-border', content)
    content = re.sub(r'border-slate-700', 'border-border', content)

    # Hover Backgrounds
    content = re.sub(r'hover:bg-white/\[?[0-9.]+\]?', 'hover:bg-accent hover:text-accent-foreground', content)
    
    # Opacity effects that make text hard to read in light mode
    # content = re.sub(r'backdrop-blur-xl', 'backdrop-blur-md', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.jsx'):
                migrate_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
