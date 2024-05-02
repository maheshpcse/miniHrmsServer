// var atmcardinfo = {
//     "cardName": 'Visa',
//     "cardType": 'Credit',
//     "cardNumber": '4593000210015836',
//     "cardHolderName": 'Zola Mraz',
//     "cvvNumber": 922,
//     "cardIssuerDate": '2022-01-01',
//     "cardExpiryDate": '2024-12-31',
//     "generalInfo": null
// }
// console.log(JSON.stringify(atmcardinfo));

const moment = require('moment');
const _ = require('underscore');

var resultsSet = [
    {
        "monthyear": "Oct-23",
        "x_axis_label": "Oct-23",
        "value": 0,
        "count": 77,
        "status": 2110003
    },
    {
        "monthyear": "Oct-23",
        "x_axis_label": "Oct-23",
        "value": 0,
        "count": 10,
        "status": 2110002
    },
    {
        "monthyear": "Oct-23",
        "x_axis_label": "Oct-23",
        "value": 0,
        "count": 1,
        "status": 2110001
    },
    {
        "monthyear": "Nov-23",
        "x_axis_label": "Nov-23",
        "value": 0,
        "count": 280,
        "status": 2110003
    },
    {
        "monthyear": "Nov-23",
        "x_axis_label": "Nov-23",
        "value": 0,
        "count": 9,
        "status": 2110002
    },
    {
        "monthyear": "Nov-23",
        "x_axis_label": "Nov-23",
        "value": 0,
        "count": 12,
        "status": 2110001
    },
    {
        "monthyear": "Dec-23",
        "x_axis_label": "Dec-23",
        "value": 0,
        "count": 11,
        "status": 2110003
    },
    {
        "monthyear": "Dec-23",
        "x_axis_label": "Dec-23",
        "value": 0,
        "count": 6,
        "status": 2110002
    },
    {
        "monthyear": "Dec-23",
        "x_axis_label": "Dec-23",
        "value": 0,
        "count": 6,
        "status": 2110001
    },
    {
        "monthyear": "Jan-24",
        "x_axis_label": "Jan-24",
        "value": 0,
        "count": 9,
        "status": 2110003
    },
    {
        "monthyear": "Feb-24",
        "x_axis_label": "Feb-24",
        "value": 0,
        "count": 0,
        "status": null
    },
    {
        "monthyear": "Mar-24",
        "x_axis_label": "Mar-24",
        "value": 0,
        "count": 2,
        "status": 2110001
    },
    {
        "monthyear": "Mar-24",
        "x_axis_label": "Mar-24",
        "value": 0,
        "count": 1,
        "status": 2110002
    },
    {
        "monthyear": "Mar-24",
        "x_axis_label": "Mar-24",
        "value": 0,
        "count": 2,
        "status": 2110003
    }
];

resultsSet.forEach((graphinfo) => {
    graphinfo.value = Number(graphinfo.count);
});

let series = [{ name: 'High', data: [0, 0, 0, 0, 0, 0] }, { name: 'Medium', data: [0, 0, 0, 0, 0, 0] }, { name: 'Low', data: [0, 0, 0, 0, 0, 0] }];
let labels = _.groupBy(resultsSet, 'x_axis_label');
console.log('labels isss:', labels);

let months = [];
for (let id = 1; id <= 6; id = id + 1) {
    let monthyear = moment().subtract(id, 'month').format('MMM-YY');
    months.push(monthyear);
}
console.log('months isss:', months);

let records = new Array();
for (let item of series[0]['data']) {
    records.push({
        XAxisLabel: '',
        High: 0,
        Medium: 0,
        Low: 0
    });
}
console.log('records isss:', records);

let id = 0;
for (let item of months) {
    records[id]['XAxisLabel'] = item;
    for (let data of labels[item]) {
        if (data['status'] == 2110001) {
            series[0]['data'][id] = data['value'];
            records[id]['High'] = data['value'];
        }
        if (data['status'] == 2110002) {
            series[1]['data'][id] = data['value'];
            records[id]['Medium'] = data['value'];
        }
        if (data['status'] == 2110003) {
            series[2]['data'][id] = data['value'];
            records[id]['Low'] = data['value'];
        }
    }
    id = id + 1;
}
console.log('final series isss:', series);
console.log('final records isss:', records);