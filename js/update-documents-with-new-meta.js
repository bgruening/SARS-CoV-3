const _ = require("lodash"),
  readline = require('readline'),
  d3 = require('d3-dsv'),
  fs = require("fs"),
  util = require("util"),
  commander = require("commander"),
  moment = require("moment"),
  mongodb = require("mongodb");

// example gisaid record
//{
//  "b": "EPI_ISL_402119",
//  "c": "hCoV-19/Wuhan/IVDC-HB-01/2019",
//  "d": "Virus Isolate, Passage 1",
//  "e": "EPI_ISL_402119",
//  "f": "2019-12-30",
//  "g": "2020-01-10",
//  "h": null,
//  "i": 29891,
//  "j": "Human",
//  "k": "Asia / China / Hubei / Wuhan",
//  "l": "National Institute for Viral Disease Control and Prevention, China CDC",
//  "m": "National Institute for Viral Disease Control and Prevention, China CDC"
//},

// example result record
//{
//  "epi_isl_402119" : {
//      "address": "National Institute for Viral Disease Control and Prevention, 155 Changbai Road, Changping District, Beijing 102206 China",
//      "age": "49",
//      "assembly": null,
//      "authors": "Wenjie Tan，Xiang Zhao，Wenling Wang，Xuejun Ma，Yongzhong Jiang，Roujian Lu, Ji Wang, Weimin Zhou，Peihua Niu，Peipei Liu，Faxian Zhan，Weifeng Shi，Baoying Huang，Jun Liu，Li Zhao，Yao Meng，Xiaozhou He，Fei Ye，Na Zhu，Yang Li，Jing Chen，Wenbo Xu，George F. Gao，Guizhen Wu",
//      "collected": "20191230",
//      "coverage": null,
//      "gender": "Female",
//      "host": "Human",
//      "id": "epi_isl_402119",
//      "lab": "National Institute for Viral Disease Control and Prevention, China CDC",
//      "location": {
//        "country": "China",
//        "locality": "Wuhan",
//        "state": "Hubei",
//        "subregion": "Asia"
//      },
//      "name": "hCoV-19/Wuhan/IVDC-HB-01/2019",
//      "passage": "Virus Isolate, Passage 1",
//      "submitted": "20200110",
//      "submitter": "Wenjie Tan",
//      "technology": null,
//      "type": "betacoronavirus"
//  }
//}

commander
  .arguments("<inputFile>", "Input filename")
  .action(cmd => {
    inputFile = cmd;
  })

commander
  .on("--help", function() {
    console.log("");
    console.log("Examples:");
    console.log("translate-to-master <file>");
  })
  .parse(process.argv);

let filename = inputFile;
let data = String(fs.readFileSync(filename));
let records = d3.tsvParse(data);

// remove duplicate seqs
console.log("Got " + records.length + " metadata records");

let adaptedRecords = _.map(records, record => {

  // switch to just keep what was there.
  let collectionDate = record.date;
  let submissionDate = record.date_submitted;

  let loc = {
    subregion: _.trim(record.region),
    country: _.trim(record.country),
    state: _.trim(record.division),
    locality: _.trim(record.location)
  };

  let acc = _.toLower(record.gisaid_epi_isl);

  let adaptedRecord = {
    address: record.originating_lab,
    genbank_accession: record.genbank_accession,
    age: parseInt(record.age),
    assembly: null,
    authors: record.authors,
    collected: moment(collectionDate).toDate(),
    originalCollected: collectionDate,
    coverage: null,
    length: parseInt(record.length),
    gender: record.sex,
    sex: record.sex,
    host: record.host,
    id: acc,
    lab: record.originating_lab,
    originating_lab: record.originating_lab,
    location: loc,
    name: record.strain,
    passage: record.e,
    seqLength: parseInt(record.length),
    submitted: moment(submissionDate).toDate(),
    originalSubmitted: submissionDate,
    submitter: record.submitting_lab,
    submitting_lab: record.submitting_lab,
    technology: null,
    type: null,
    nextstrainClade : record.Nextstrain_clade,
    pangolinLineage : record.pangolin_lineage,
    gisaidClade : record.GISAID_clade
  };

  return adaptedRecord;

});

const MongoClient = mongodb.MongoClient;
const url = 'mongodb://129.32.209.134:27017';
const dbName = 'gisaid';
const collectionName = 'records';

// Use the connect method to create a connection w/ the database
MongoClient.connect(url, (err, client) => {

  if (err) {
    throw err;
    return;
  }

  console.log('Database connection successful');

  // This objects holds the refrence to the db
  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  const l = adaptedRecords.length;
  let c = 0;


  let bulkUpdates = _.map(adaptedRecords, adaptedRecord => {
      return { updateMany :
        {
          "filter": { 'id': adaptedRecord.id},
          "update": { '$set': 
                           { 
                              'pangolinLineage' : adaptedRecord.pangolinLineage
                           }
                         }
        }
      }} );

  collection.bulkWrite(bulkUpdates, (err, results) => {
    client.close();  
    process.exit(0);
  });

  //_.each(adaptedRecords, adaptedRecord => {
  //  collection.updateOne({'id': adaptedRecord.id}, 
  //                       {'$set': 
  //                         { 
  //                            'nextstrainClade' : adaptedRecord.nextstrainClade ,
  //                            'pangolinLineage' : adaptedRecord.pangolinLineage,
  //                            'gisaidClade' : adaptedRecord.gisaidClade
  //                         }
  //                       }, (err, result) => { 
  //                         c += 1; 
  //                         console.log(adaptedRecord.id);
  //                         console.log(c);
  //                         if (c == adaptedRecords.length) {
  //                            client.close();
  //                            process.exit(0)
  //                         }
  //                       });
  //});

});

