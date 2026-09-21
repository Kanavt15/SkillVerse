/**
 * Start a local MongoDB for development — `npm run mongo`.
 *
 * SkillVerse uses multi-document transactions (enrollment, lesson completion,
 * payments) and those require a REPLICA SET. A plain `mongod` will start
 * happily and then fail every checkout, so this script always configures a
 * single-node replica set and initiates it.
 *
 * It looks for a mongod binary in this order:
 *   1. MONGOD_PATH, if set
 *   2. mongod on PATH
 *   3. the binary mongodb-memory-server downloaded for the test suite
 *
 * That third fallback means a working dev database needs no separate MongoDB
 * install — `npm install` already fetched one.
 *
 * Data persists in <repo>/.local/mongo-data (gitignored).
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = parseInt(process.env.MONGO_DEV_PORT, 10) || 27017;
const REPL_SET = 'rs0';
const DATA_DIR = path.resolve(__dirname, '..', '..', '.local', 'mongo-data');

function findMongod() {
    if (process.env.MONGOD_PATH && fs.existsSync(process.env.MONGOD_PATH)) {
        return process.env.MONGOD_PATH;
    }

    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['mongod'], {
        encoding: 'utf8',
    });
    if (probe.status === 0 && probe.stdout.trim()) {
        return probe.stdout.trim().split(/\r?\n/)[0];
    }

    // Binary cached by mongodb-memory-server (a devDependency).
    const cacheDir = path.join(os.homedir(), '.cache', 'mongodb-binaries');
    if (fs.existsSync(cacheDir)) {
        const found = fs.readdirSync(cacheDir).find((f) => f.startsWith('mongod'));
        if (found) return path.join(cacheDir, found);
    }

    return null;
}

/** Initiate the replica set, retrying while mongod finishes booting. */
async function initiateReplicaSet() {
    const { MongoClient } = require('mongodb');
    const uri = `mongodb://127.0.0.1:${PORT}/?directConnection=true`;

    for (let attempt = 0; attempt < 40; attempt += 1) {
        let client;
        try {
            client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000 });
            await client.connect();
            const admin = client.db('admin');

            try {
                const status = await admin.command({ replSetGetStatus: 1 });
                console.log(`✅ Replica set "${status.set}" ready (${status.myState === 1 ? 'PRIMARY' : `state ${status.myState}`})`);
                return true;
            } catch (err) {
                const notInitialized = err.codeName === 'NotYetInitialized'
                    || /no replset config/i.test(err.message || '');
                if (!notInitialized) throw err;

                await admin.command({
                    replSetInitiate: {
                        _id: REPL_SET,
                        members: [{ _id: 0, host: `127.0.0.1:${PORT}` }],
                    },
                });
                console.log('✅ Replica set initiated');
                return true;
            }
        } catch {
            await new Promise((r) => { setTimeout(r, 750); });
        } finally {
            if (client) await client.close().catch(() => {});
        }
    }

    console.error('❌ Could not initiate the replica set — transactions will not work.');
    return false;
}

function main() {
    const mongod = findMongod();
    if (!mongod) {
        console.error(
            '❌ No mongod binary found.\n'
            + '   Install MongoDB, set MONGOD_PATH, or run `npm install` in backend/\n'
            + '   (the test suite downloads one automatically).'
        );
        process.exit(1);
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });

    console.log(`🍃 mongod: ${mongod}`);
    console.log(`📁 data:   ${DATA_DIR}`);
    console.log(`🔗 uri:    mongodb://localhost:${PORT}/skillverse?replicaSet=${REPL_SET}\n`);

    const child = spawn(mongod, [
        '--replSet', REPL_SET,
        '--port', String(PORT),
        '--dbpath', DATA_DIR,
        '--bind_ip', '127.0.0.1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    // mongod is very chatty; surface only what matters during dev.
    child.stdout.on('data', (buf) => {
        const text = buf.toString();
        if (/waiting for connections|error|exception/i.test(text)) {
            process.stdout.write(text.split('\n').slice(0, 2).join('\n') + '\n');
        }
    });
    child.stderr.on('data', (buf) => process.stderr.write(buf));

    child.on('exit', (code) => {
        console.log(`mongod exited with code ${code}`);
        process.exit(code ?? 0);
    });

    initiateReplicaSet().then((ok) => {
        if (ok) console.log('\n🚀 MongoDB is ready. Run `npm run seed`, then `npm run dev`.\n');
    });

    const shutdown = () => {
        console.log('\nStopping mongod...');
        child.kill('SIGINT');
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();
