// ==UserScript==
// @name         BBT Manager Plugin
// @namespace    http://burtbrothers.com/
// @version      1.1.0
// @description  None
// @author       BBT IT
// @match        *://*.replicon.com/StratusHR132/schedulemanagement/*
// @grant        none
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @run-at       document-end
// ==/UserScript==

//Delay start of script to allow page to fully load.  Large schedules will only load 50% until scroll.
$(document).ready(function() {
    window.setTimeout(scroll, 3500);
});

//Determines size of employee lists and waits if needed.
function scroll() {
$("html, body").animate({ scrollTop: $(document).height() }, "slow");
    let employeeCount = $('a.recordCount').text()
    if(Number(employeeCount.substring(employeeCount.length - 2 )) > 19) {
    window.setTimeout(getEmployeeList, 3500);
} else {

  getEmployeeList()

}
}

let employeeGrid
let users = []
let userPay = []

function delay() {
  return new Promise(resolve => setTimeout(resolve, 100));
}

async function delayedLog(user) {
  await delay();
}

//Gets schedule which includes each employees user details
function getEmployeeList() {
    
    employeeGrid = $('div.primaryPanel').find('tr');
    var i;
    for (i = 0; i < employeeGrid.length; i++) {
        if (employeeGrid[i].firstChild.attributes.useruri != undefined) {
            if(employeeGrid[i].firstChild.attributes.useruri.value.length > 30){
                users.push(employeeGrid[i].firstChild.attributes.useruri.value.toString())
            }

        }
    }

    getPayRates();
}


//Uses employee details to look up current pay rate
async function getPayRates(){

for (const user of users) {
    $.ajax({
            url: "https://na3.replicon.com/services/ImportService1.svc/BulkGetUsers3",
            method: "POST",
            contentType: "application/json",
            dataType: 'json',
            data: JSON.stringify({ users: [{uri: user}]}),
            success: function(result){
                let userPayRate = result.d[0].payrollRateSchedule;
                userPay.push(user, userPayRate[userPayRate.length - 1].hourlyRate.amount)
            }
        })
    await delayedLog(user)
    };

   updateScheduleGridWithPay();
}

let employeeWeekWithPay = [];
let day0 = []; //Sunday
let day1 = []; //Monday
let day2 = []; //Tuesday
let day3 = []; //Wednesday
let day4 = []; //Thursday
let day5 = []; //Friday
let day6 = []; //Saturday

async function updateScheduleGridWithPay(){

    var i;
    var j;
    var k;
    let daysScheduled = [];
    let dayIndex = [];
    let dayList = $("table.dataGrid.listPageGrid.scheduleGrid thead tr th.gi.scheduleCell");

    //Create dayIndex to allow lookup based on date when calculating each employees daily pay
    for (k = 0; k < 7; k++) {
        dayIndex.push(Number(dayList[k].innerText.split(' ')[1]))
    }

    //Uses list of user from above to find the days that each employee is working.
    for (i = 0; i < users.length; i++) {
        daysScheduled = ($("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails"))

        //Setting these to 0 so that each iteration of the outer FOR loop resets.
        let totalPay = 0
        let totalHours = 0
        let totalOT = 0

        await delayedLog(users[i])

        //Calculates and inserts the daily pay for each scheduled item
        for (j = 0; j < daysScheduled.length; j++) {
            let date = $("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").closest("td[datestr]").attr("datestr").split('-')[2];
            let time = $("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").text()
            let startAndEnd = time.split('-')
            let hours = (new Date('01/01/2023 ' + startAndEnd[1]) - new Date('01/01/2023 ' + startAndEnd[0])) / 1000 / 60 / 60;
            let amount = 0;
            let pay = userPay[userPay.lastIndexOf(users[i]) + 1]
            amount = pay * hours;
            totalHours+=hours

            //Overtime logic and calculation
            if (totalHours <= 40){
                totalPay+=amount;
                $("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").attr("titlehtml", 'Regular: ' + formatter.format(amount) + ' | OT: $0')
            } else {
                totalOT = totalHours - 40 - totalOT
                let regular = (hours - totalOT) * pay
                let ot = totalOT * (pay * 1.5)
                amount = regular + ot
                $("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").attr("titlehtml", 'Regular: ' + formatter.format(regular) + ' | OT: ' + formatter.format(ot) + '')
            }

            //Inserts daily pay amount into each employees scheduled item
            $("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").text($("td[useruri='" + users[i] + "'] ul li a div span.timings.assignmentDetails:eq(" + j + ")").text() + "[" + formatter.format(amount) + "]")


            //Uses date from each schedule item to insert total daily pay into correct day of week
            switch (dayIndex.indexOf(Number(date))) {
                case 0:
                    day0.push(amount);
                    break;
                case 1:
                    day1.push(amount);
                    break;
                case 2:
                    day2.push(amount);
                    break;
                case 3:
                    day3.push(amount);
                    break;
                case 4:
                    day4.push(amount);
                    break;
                case 5:
                    day5.push(amount);
                    break;
                case 6:
                    day6.push(amount);
                    break;
            }
            if (j===daysScheduled.length - 1){
                if (totalHours > 40) {
                    let regular = 40 * pay
                    let OT = (totalHours - 40) * (pay * 1.5)
                    totalPay = regular + OT
                }
                employeeWeekWithPay.push([users[i], totalPay]);
            }
        }

    }
    //Setting delay to allow data to load and to scroll to bottom of page due to Replicon bug.
    $(document).ready(function() {
        window.setTimeout(fillTotals, 2000);
    });
}

function fillTotals() {
    //Sums each day to fill the totals footer
    var sum0 = day0.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum1 = day1.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum2 = day2.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum3 = day3.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum4 = day4.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum5 = day5.reduce(function(a, b){
        return a + b;
    }, 0);
    var sum6 = day6.reduce(function(a, b){
        return a + b;
    }, 0);
    let weekTotal = sum0 + sum1 + sum2 + sum3 + sum4 + sum5 + sum6

    //Updates footer with total for each day
    if (sum0 == 0) {
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(0) div").append("<span>" + formatter.format(weekTotal) + "</span>")
    } else {
         $('td[useruri="urn:replicon:user:no-user"]:eq(0)').append("<span>Total for week: " + formatter.format(weekTotal) + "</span>")
        $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(0) div").append("<span>" + formatter.format(sum0) + "</span>")
    }
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(1) div").append("<span>" + formatter.format(sum1) + "</span>")
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(2) div").append("<span>" + formatter.format(sum2) + "</span>")
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(3) div").append("<span>" + formatter.format(sum3) + "</span>")
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(4) div").append("<span>" + formatter.format(sum4) + "</span>")
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(5) div").append("<span>" + formatter.format(sum5) + "</span>")
    $("table.dataGrid.listPageGrid.scheduleGrid tfoot tr:eq(1) td:eq(6) div").append("<span>" + formatter.format(sum6) + "</span>")

    //Updates employee list with total pay for week based on their scheduled hours
    //TODO:  Fix and account for people in the list but not scheduled during the week
//     let employeeList = $("div.frozenPanel:eq(0) table tbody tr td div")
//     let w = 0
//     for (w = 1; w < employeeList.length ; w++) {
//        $("div.frozenPanel:eq(0) table tbody tr td div:eq(" + w + ")").text($("div.frozenPanel:eq(0) table tbody tr td div:eq(" + w + ")").text().split('|')[0] + " | " + formatter.format(employeeWeekWithPay[w - 1][1]))
//        }
}

//Number formatter
var formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
