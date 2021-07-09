const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const chalk = require('chalk')

// Setup json dbs
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

// Data dump
const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ blocks: [], uncles: [], blocksCount: 0, unclesCount: 0 }).write()

// Error dump
const adapter2 = new FileSync('errors.json')
const errorDB = low(adapter2)
errorDB.defaults({ errors: [], count: 0 }).write()


const startBlock = 11550019 // block height at which first bundle was mined by mev-geth, dec 29th
const endBlock = 12793993 // block from today

const blockWithUncle = 12793799 // just for testing, ignore


const getUncleBlock = async(blockHash) => {
    const block = await provider.send("eth_getBlockByHash", [blockHash, true])
    return block
}

// i.e how much a miner earns in net after mining a block
const getCoinbaseDiff = async(coinbaseAddress, blockNo) => {
    const minerBalanceBefore = await provider.getBalance(coinbaseAddress, blockNo - 1)
    const minerBalanceAfter = await provider.getBalance(coinbaseAddress, blockNo)
    const minerProfit = minerBalanceAfter.sub(minerBalanceBefore)
    const minerProfitETH = (ethers.utils.formatEther(minerProfit))
    return (parseFloat(minerProfitETH))
}

const main = async() => {

    for(var i=startBlock;i<=endBlock;i++){
        try{
            const blockNo = i
    
            // the regular provider.getBlock does not return uncles, we use the direct client call instead
            const block = await provider.send("eth_getBlockByNumber", [blockNo, true])
            const blockHash = block.hash
            const parentHash = block.parentHash
            const hasUncle = block.uncles.length > 0
            const coinbaseAddress = block.miner
            const coinbaseDiff = await getCoinbaseDiff(coinbaseAddress, blockNo)
    
            // insert into json
            // block, blockHash, parentHash, hasUncle?, coinbaseDiff, coinbaseAddress
            db.get('blocks').push({
                blockNo,
                blockHash,
                parentHash,
                hasUncle,
                coinbaseDiff,
                coinbaseAddress
            }).write()
            db.update('blocksCount', n => n + 1).write()
    
            console.log(`Block #: ${blockNo}`)
            console.log(`hasUncle?: ${hasUncle}`)
            if(hasUncle){
                // A block can have upto 2 uncles, map over to account that
                for(var j=0;j<block.uncles.length;j++){
                    const blockHash = block.uncles[j]
                    const uncleBlock = await getUncleBlock(blockHash)
                    console.log(chalk.red(`Uncle block found at block height ${blockNo}: ${blockHash} (uncle'd for block height #${parseInt(uncleBlock.number)})`))
                    console.log(chalk.red(`# of txs in uncle: ${uncleBlock.transactions.length}`))
                    // write uncle data into json
                    db.get('uncles').push({
                        uncleBlockHash: blockHash,
                        uncleBlockTargetNo: parseInt(uncleBlock.number),
                        uncleBlockIncludedAt: blockNo,
                        uncleTxCount: uncleBlock.transactions.length
                        // , uncleBlockContent: uncleBlock 
                        // ^uncomment this when you want uncle tx data to simulate
                        // removing for now to avoid json size growing too much
                    }).write()
                    db.update('unclesCount', n => n + 1).write()
                }
            }
        }catch(error){
            // log errors incase rpc breaks halfway through
            errorDB.get('errors').push({
                blockNo: i,
                error: error
            }).write()
            errorDB.update('count', n => n + 1).write()
        }
    }
}

main()