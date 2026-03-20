const fs = require('fs');
const path = require('path');

function migrateFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');
    const original = content;

    // Backgrounds
    content = content.replace(/bg-\[#0a0e1a\]/g, 'bg-background');
    content = content.replace(/bg-\[#0f1629\]/g, 'bg-background');
    content = content.replace(/bg-\[#111827\]/g, 'bg-background');
    content = content.replace(/bg-white\/\[?[0-9.]+\]?/g, 'bg-card border border-border shadow-sm');
    
    // Texts
    content = content.replace(/text-foreground/g, 'text-foreground');
    content = content.replace(/text-muted-foreground/g, 'text-muted-foreground');
    content = content.replace(/text-muted-foreground/g, 'text-muted-foreground');
    content = content.replace(/text-muted-foreground text-opacity-80/g, 'text-muted-foreground text-opacity-80');
    content = content.replace(/text-muted-foreground text-opacity-60/g, 'text-muted-foreground text-opacity-60');
    content = content.replace(/text-muted-foreground text-opacity-40/g, 'text-muted-foreground text-opacity-40');
    
    // Borders
    content = content.replace(/border-white\/\[?[0-9.]+\]?/g, 'border-border');
    content = content.replace(/border-border/g, 'border-border');
    content = content.replace(/border-border/g, 'border-border');

    // Hover Backgrounds
    content = content.replace(/hover:bg-white\/\[?[0-9.]+\]?/g, 'hover:bg-accent hover:text-accent-foreground transition-colors');

    // Add bg-card border border-border shadow-sm utility to Tailwind or just use standard
    content = content.replace(/bg-card border border-border shadow-sm/g, 'bg-card border border-border shadow-sm');
    
    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`Updated ${filepath}`);
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            processDirectory(filepath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            migrateFile(filepath);
        }
    }
}

processDirectory(__dirname);
