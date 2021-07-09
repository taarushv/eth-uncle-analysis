// Setup json dbs
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

// Data dump
const adapter = new FileSync('db.json')
const db = low(adapter)

const getCount = () => {
    console.log(db.get('blocksCount').value())
}

getCount()