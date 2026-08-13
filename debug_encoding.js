const fs = require('fs');
const path = require('path');

const files = ['messages/fr.json', 'messages/en.json'];

files.forEach(file => {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fixed = Buffer.from(content, 'binary').toString('utf8');

        try {
            JSON.parse(fixed);
            fs.writeFileSync(filePath, fixed, 'utf8');
            console.log(`Successfully fixed encoding for ${file}`);
        } catch (error) {
            console.error(`Error processing ${file}:`, error.message);
            // Print context around error
            const match = error.message.match(/position (\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                const start = Math.max(0, pos - 50);
                const end = Math.min(fixed.length, pos + 50);
                console.log('Context:', JSON.stringify(fixed.substring(start, end)));
                console.log('Char at pos:', fixed.charCodeAt(pos));
            }
        }
    }
});
