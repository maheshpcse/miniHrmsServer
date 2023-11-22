require('./source/server.js');

// var _achFees = 'test data';
// var isACHFeeTrue = false;

// if(_achFees != null && _achFees != undefined)
// isACHFeeTrue = true;

// console.log('isACHFeeTrue isss:', isACHFeeTrue);

// var fees = 'OB-2026';
// console.log(fees.split('-')[1].split(''));

// if (fees && fees.split('-')[1].split('')[0] != '1') {
//     console.log('Fees validation failed');
// } else {
//     console.log('Fess validation success');
// }

// const _ = require('underscore');

// var discounts = [
//     {
//         "discItemCode": "OB-1026",
//         "discRatePercent": 10,
//         "discPerItemAmount": 10
//     },
//     {
//         "discItemCode": "OB-1029",
//         "discRatePercent": 10,
//         "discPerItemAmount": 10
//     },
//     {
//         "discItemCode": "OB-1026",
//         "discRatePercent": 0.002,
//         "discPerItemAmount": ""
//     },
//     {
//         "discItemCode": "OB-1026",
//         "discRatePercent": "0.003",
//         "discPerItemAmount": "2"
//     }
// ];

// var groupByNames = _.groupBy(discounts, 'discItemCode') || {};
// // console.log('groupByNames', groupByNames);

// let count = {};

// let abc = [];
// for (let i = 0; i < discounts.length; i += 1) {
//     // if (groupByNames.hasOwnProperty(discounts[i]['discItemCode']) && groupByNames[discounts[i]['discItemCode']].length > 1) {
//     //     console.log('duplicate found', discounts[i]['discItemCode'], i);
//     //     count[i] = i;
//     // }
//     // if (Object.keys(count).length > 1) {
//     //     let duplicateArr = Object.keys(count);
//     //     console.log('index isss:', duplicateArr[1]);
//     //     count = {};
//     // }
//     if (abc.includes(discounts[i]['discItemCode'])) {
//         console.log('duplicate found', i);
//     } else {
//         abc.push(discounts[i]['discItemCode']);
//         console.log(abc);
//     }
// }

// const arrowFuc = () => arguments.length;
// console.log(arrowFuc());

// const moment = require('moment');
// const moment_timezone = require('moment-timezone');

// var currentTime = moment('2023-11-20 03:33:16').format('DD/MM/YYYY HH:mm:ss');
// var momentTime = moment(new Date());
// var timezoneTime = momentTime.tz('America/Chicago').format('DD/MM/YYYY HH:mm:ss');

// console.log('currentTime isss:', currentTime);
// console.log('momentTime isss:', momentTime, moment.tz.guess(), momentTime.isLocal());
// console.log('timezoneTime isss:', timezoneTime);

// var mccCode = "!@23";
// var reg = /^\d+$/;

// if ((mccCode && typeof(mccCode) == 'string' && mccCode.toString().trim() != '') &&
//     !(mccCode && typeof(mccCode) == 'string' && mccCode.length == 4 && typeof(Number(mccCode)) == 'number' && reg.test(mccCode))) {
//     console.log('MCC code Validation failed.');
// } else {
//     console.log('MCC code Validation success.');
// }

// const _ = require('underscore');
// const moment = require('moment');

// ********************************* Start **********************************************
// var result = [
//     {
//         "monthName": "07-2022",
//         "TransactionAmount": 276321.5000,
//         "TransactionCount": 5088,
//         "cCardType": 1
//     },
//     {
//         "monthName": "07-2022",
//         "TransactionAmount": 3460.0000,
//         "TransactionCount": 57,
//         "cCardType": 2
//     },
//     {
//         "monthName": "07-2022",
//         "TransactionAmount": 53004.5000,
//         "TransactionCount": 898,
//         "cCardType": 4
//     },
//     {
//         "monthName": "07-2022",
//         "TransactionAmount": 4158.5000,
//         "TransactionCount": 77,
//         "cCardType": 5
//     },
//     {
//         "monthName": "08-2022",
//         "TransactionAmount": 1053892.0000,
//         "TransactionCount": 15825,
//         "cCardType": 1
//     },
//     {
//         "monthName": "08-2022",
//         "TransactionAmount": 21047.5000,
//         "TransactionCount": 272,
//         "cCardType": 2
//     },
//     {
//         "monthName": "08-2022",
//         "TransactionAmount": 225680.5000,
//         "TransactionCount": 3296,
//         "cCardType": 4
//     },
//     {
//         "monthName": "08-2022",
//         "TransactionAmount": 20353.5000,
//         "TransactionCount": 289,
//         "cCardType": 5
//     }
// ];

// var groupByData = _.groupBy(result, 'cCardType');

// var finalResult = [];

// for (let item of Object.keys(groupByData)) {
//     let obj = {
//         "TransactionAmount": _.reduceRight(groupByData[item], (a, b) => {
//             return Number(a) + Number(b.TransactionAmount)
//         }, 0),
//         "TransactionCount": _.reduceRight(groupByData[item], (a, b) => {
//             return Number(a) + Number(b.TransactionCount)
//         }, 0),
//         "cCardType": Number(item)
//     }
//     finalResult.push(obj);
// }

// console.log('finalResult isss:', finalResult);


// var arr1 = [1,2,3];
// var arr2 = [4,5,6];
// console.log('data issss:', arr1.concat(arr2));
// console.log('flatten array isss:', _.flatten([[1,2,3],[4,5,6]]));
// ********************************* End **********************************************


// ********************************* Start **********************************************
// let transData = {
//     "Jan-2023": [
//         116304,
//         2125533.18,
//         38,
//         1057.13,
//         60130,
//         1136190.32,
//         3351,
//         71576.47,
//         38,
//         605.28
//     ],
//     "Feb-2023": [
//         143380,
//         2661791.86,
//         46,
//         763.6,
//         75197,
//         1452541.29,
//         4241,
//         90496.52,
//         43,
//         594
//     ],
//     "Mar-2023": [
//         134097,
//         2441432.55,
//         52,
//         818.2,
//         69384,
//         1321543.32,
//         4205,
//         86417.15,
//         40,
//         638.95
//     ],
//     "Jul-2023": [
//         13200,
//         243898.63,
//         6,
//         118.96,
//         7323,
//         143406.38,
//         430,
//         8780.85,
//         3,
//         69
//     ],
//     "Aug-2022": [
//         12643,
//         265942.65,
//         0,
//         0,
//         9230,
//         181253.36,
//         0,
//         0,
//         0,
//         0
//     ],
//     "Sep-2022": [
//         13901,
//         286173.88,
//         1,
//         24,
//         9222,
//         177997.62,
//         69,
//         1932.95,
//         3,
//         43
//     ],
//     "Oct-2022": [
//         52175,
//         966905.66,
//         17,
//         382.88,
//         27377,
//         517081.86,
//         1418,
//         28647.57,
//         13,
//         191.98
//     ],
//     "Nov-2022": [
//         84415,
//         1533085.6,
//         26,
//         715.5,
//         44103,
//         800680.98,
//         2670,
//         55490.08,
//         29,
//         602.46
//     ],
//     "Dec-2022": [
//         114997,
//         2113704.82,
//         47,
//         869.18,
//         59885,
//         1126538.48,
//         3295,
//         72539.8,
//         27,
//         335.98
//     ]
// };
// let monthYears = Object.keys(transData) || [];

// function compareNumbers(a, b) {
//     return b - a;
// }

// let allMonths = {};

// for (let id = 12; id >= 1; id -= 1) {
//     let year = moment().format('YYYY');
//     let zero = 0;
//     let month = moment(`${year}-${id.toString().padStart(2, zero)}-01`).format('MMM');
//     allMonths[month] = id;
// }
// console.log('allMonths isss:', allMonths);

// var years = {};

// for (let item of monthYears) {
//     let year = item.split("-");
//     years[year[1]] = Object.keys(years).length - 1;
// }
// let finalYears = Object.keys(years).sort(compareNumbers);
// console.log('finalYears isss:', finalYears);

// let finalTransData = {};

// for (const item of finalYears) {
//     for (const data of Object.keys(allMonths)) {
//         let keyName = `${data}-${item}`;
//         if (transData && transData.hasOwnProperty(keyName)) {
//             finalTransData[keyName] = transData[keyName];
//         }
//     }
// }
// console.log('finalTransData isss:', finalTransData);


// Export data
// let YTDTransByCardBrand = [
//     {
//         monthName: 'Jan-2023',
//         VisaSalesNo: 116304,
//         VisaSalesVol: 2125533.18,
//         AMEXSalesNo: 38,
//         AMEXSalesVol: 1057.13,
//         'Master CardSalesNo': 60130,
//         'Master CardSalesVol': 1136190.32,
//         DiscoverSalesNo: 3351,
//         DiscoverSalesVol: 71576.47,
//         OtherSalesNo: 38,
//         OtherSalesVol: 605.28
//     },
//     {
//         monthName: 'Feb-2023',
//         VisaSalesNo: 143380,
//         VisaSalesVol: 2661791.86,
//         AMEXSalesNo: 46,
//         AMEXSalesVol: 763.6,
//         'Master CardSalesNo': 75197,
//         'Master CardSalesVol': 1452541.29,
//         DiscoverSalesNo: 4241,
//         DiscoverSalesVol: 90496.52,
//         OtherSalesNo: 43,
//         OtherSalesVol: 594
//     },
//     {
//         monthName: 'Mar-2023',
//         VisaSalesNo: 134097,
//         VisaSalesVol: 2441432.55,
//         AMEXSalesNo: 52,
//         AMEXSalesVol: 818.2,
//         'Master CardSalesNo': 69384,
//         'Master CardSalesVol': 1321543.32,
//         DiscoverSalesNo: 4205,
//         DiscoverSalesVol: 86417.15,
//         OtherSalesNo: 40,
//         OtherSalesVol: 638.95
//     },
//     {
//         monthName: 'Jul-2023',
//         VisaSalesNo: 13200,
//         VisaSalesVol: 243898.63,
//         AMEXSalesNo: 6,
//         AMEXSalesVol: 118.96,
//         'Master CardSalesNo': 7323,
//         'Master CardSalesVol': 143406.38,
//         DiscoverSalesNo: 430,
//         DiscoverSalesVol: 8780.85,
//         OtherSalesNo: 3,
//         OtherSalesVol: 69
//     },
//     {
//         monthName: 'Aug-2022',
//         VisaSalesNo: 12643,
//         VisaSalesVol: 265942.65,
//         AMEXSalesNo: 0,
//         AMEXSalesVol: 0,
//         'Master CardSalesNo': 9230,
//         'Master CardSalesVol': 181253.36,
//         DiscoverSalesNo: 0,
//         DiscoverSalesVol: 0,
//         OtherSalesNo: 0,
//         OtherSalesVol: 0
//     },
//     {
//         monthName: 'Sep-2022',
//         VisaSalesNo: 13901,
//         VisaSalesVol: 286173.88,
//         AMEXSalesNo: 1,
//         AMEXSalesVol: 24,
//         'Master CardSalesNo': 9222,
//         'Master CardSalesVol': 177997.62,
//         DiscoverSalesNo: 69,
//         DiscoverSalesVol: 1932.95,
//         OtherSalesNo: 3,
//         OtherSalesVol: 43
//     },
//     {
//         monthName: 'Oct-2022',
//         VisaSalesNo: 52175,
//         VisaSalesVol: 966905.66,
//         AMEXSalesNo: 17,
//         AMEXSalesVol: 382.88,
//         'Master CardSalesNo': 27377,
//         'Master CardSalesVol': 517081.86,
//         DiscoverSalesNo: 1418,
//         DiscoverSalesVol: 28647.57,
//         OtherSalesNo: 13,
//         OtherSalesVol: 191.98
//     },
//     {
//         monthName: 'Nov-2022',
//         VisaSalesNo: 84415,
//         VisaSalesVol: 1533085.6,
//         AMEXSalesNo: 26,
//         AMEXSalesVol: 715.5,
//         'Master CardSalesNo': 44103,
//         'Master CardSalesVol': 800680.98,
//         DiscoverSalesNo: 2670,
//         DiscoverSalesVol: 55490.08,
//         OtherSalesNo: 29,
//         OtherSalesVol: 602.46
//     },
//     {
//         monthName: 'Dec-2022',
//         VisaSalesNo: 114997,
//         VisaSalesVol: 2113704.82,
//         AMEXSalesNo: 47,
//         AMEXSalesVol: 869.18,
//         'Master CardSalesNo': 59885,
//         'Master CardSalesVol': 1126538.48,
//         DiscoverSalesNo: 3295,
//         DiscoverSalesVol: 72539.8,
//         OtherSalesNo: 27,
//         OtherSalesVol: 335.98
//     }
// ];


// let finalYTDTransByCardBrand = [];

// for (const item of finalYears) {
//     for (const data of Object.keys(allMonths)) {
//         let keyName = `${data}-${item}`;
//         for (const monthItem of YTDTransByCardBrand) {
//             if (monthItem['monthName'] == keyName) {
//                 finalYTDTransByCardBrand.push(monthItem);
//             }
//         }
//     }
// }
// console.log('finalYTDTransByCardBrand isss:', finalYTDTransByCardBrand);


// let allDates = {
//     "30/09/2023": 30,
//     "29/09/2023": 29,
//     "28/09/2023": 28,
//     "27/09/2023": 27,
//     "26/09/2023": 26,
//     "25/09/2023": 25,
//     "24/09/2023": 24,
//     "23/09/2023": 23,
//     "22/09/2023": 22,
//     "21/09/2023": 21,
//     "20/09/2023": 20,
//     "19/09/2023": 19,
//     "18/09/2023": 18,
//     "17/09/2023": 17,
//     "16/09/2023": 16,
//     "15/09/2023": 15,
//     "14/09/2023": 14,
//     "13/09/2023": 13,
//     "12/09/2023": 12,
//     "11/09/2023": 11,
//     "10/09/2023": 10,
//     "09/09/2023": 9,
//     "08/09/2023": 8,
//     "07/09/2023": 7,
//     "06/09/2023": 6,
//     "05/09/2023": 5,
//     "04/09/2023": 4,
//     "03/09/2023": 3,
//     "02/09/2023": 2,
//     "01/09/2023": 1
// };
// var dates = [];

// for (let item of Object.keys(allDates)) {
//     let fullDate = `${item.split('/')[2]}-${item.split('/')[1]}-${item.split('/')[0]}`;
//     dates.push(new Date(fullDate));
// }
// console.log('dates isss:', dates);

// var maxDate = new Date(Math.max.apply(null, dates));
// var minDate = new Date(Math.min.apply(null, dates));
// console.log('maxDate isss:', maxDate);
// console.log('minDate isss:', minDate);

// const listDate = [];
// const startDate = moment(minDate).format('YYYY-MM-DD');
// const endDate = moment(maxDate).format('YYYY-MM-DD');
// const dateMove = new Date(startDate);
// let strDate = startDate;

// while (strDate < endDate) {
//     strDate = dateMove.toISOString().slice(0, 10);
//     listDate.push(strDate);
//     dateMove.setDate(dateMove.getDate() + 1);
// };
// console.log('listDate isss:', listDate);



// const listDate = [];
// const startDate = '2020-01-01';
// const endDate = moment().format('YYYY-MM-DD');
// const dateMove = new Date(startDate);
// let strDate = startDate;

// while (strDate < endDate) {
//     strDate = dateMove.toISOString().slice(0, 10);
//     listDate.push(strDate);
//     dateMove.setMonth(dateMove.getMonth() + 1);
// };
// listDate.pop();
// console.log('listDate isss:', listDate);