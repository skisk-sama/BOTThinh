const { TeamsActivityHandler, CardFactory, TurnContext, TeamsInfo } = require("botbuilder");
const rawWelcomeCard = require("./adaptiveCards/welcome.json");
const rawLearnCard = require("./adaptiveCards/learn.json");
const rawHelpcard = require("./adaptiveCards/help.json")
const ACData = require("adaptivecards-templating");
var qnaData = new Map();
var fs = require("fs");
const { parse } = require("path");
var isTimeout = [];
var question;
var lecturerName;
var lecturerMail;
// var answer = [];
var members = [];
var correctList = [];
var attemptList = [];
// [  1    2     3     4     5]
// [true true true true true] => end all => tat ca true
// [attempt1 attemp2 attemp3 attemp4 attemp5]
// [correct1 correct2 correct3 correct4 correct5]
// [timeout1 timeout2 timeout3 timeout4 timeout5]
var isEnd = [];

var currentQuestionID;

class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();

    // record the likeCount
    this.likeCountObj = { likeCount: 0 };


    this.onMessage(async (context, next) => {
      const mentions = TurnContext.getMentions(context.activity);

      //fetch user information
      var continuationToken;
      do {
        var pagedMembers = await TeamsInfo.getPagedMembers(context, 100, continuationToken);
        continuationToken = pagedMembers.continuationToken;
        members.push(...pagedMembers.members);
      }
      while (continuationToken !== undefined)

      // // By calling next() you ensure that the next BotHandler is run.
      console.log(context.activity.membersAdded);

      console.log("Running with Message Activity.");
      let txt = context.activity.text;
      if (mentions[0] != undefined) {
        txt = txt.replace(mentions[0].text, "").replace(/\n|\r/g, "").trim();
      }
      // const removedMentionText = TurnContext.removeRecipientMention(
      //   context.activity
      // );
      if (txt.startsWith("Question")) {
        var user = members.find(member => context.activity.from.name === member.name);
        // lecturerMail = user.email;
        // lecturerName = context.activity.from.name;
        // if(!user.email.includes("student")){
        question = txt;
        attemptList.push(0);
        correctList.push("");
        isTimeout.push(false);
        isEnd.push(false);
        context.sendActivity("Question has been received! Starting to collect Answers from now!!");
        qnaData.set(question, []);
        // }
        // else{
        // context.sendActivity("@" + user.name + " you are not the lecturer");
        // }
      }
      else if (txt.startsWith("Timeout for question")) {
        // tat ca phai doi ve ms tu` h, m, s
        // input se co dang 1h, 30m, 50s
        let timeout = txt.replace("Timeout for question", "").trim().split(" ")[1];
        // 1h = timeout => timeout.replace("h","") = "1"
        let time = 0;
        // endswith
        if (timeout.endsWith("h")) {
          time = parseInt(timeout.replace("h", ""), 10) * 3600 * 1000;
        } else if (timeout.endsWith("m")) {
          time = parseInt(timeout.replace("m", ""), 10) * 60 * 1000;
        } else if (timeout.endsWith("s")) {
          time = parseInt(timeout.replace("s", ""), 10) * 1000;
        } else {
          time = 300000;
        }

        setTimeout(() => {
          isTimeout[timeout[0] - 1] = true;
        }, time);
      }
      else if (txt.startsWith("Attempt for question")) {
        // 3 3         //" thinh " => sau khi trim => "thinh"
        if (Array.from(qnaData.keys()).length >= txt.replace("Attempt for question", "").trim().split(" ")[1]) {
          let currentAttempt = txt.replace("Attempt for question", "").trim().split(" ");
          attemptList[currentAttempt[0] - 1] = currentAttempt[1];
        } else {
          context.sendActivity(`There is no question for this attempt. `);
        }
      }
      else if (txt.startsWith("Choose Question")) {
        if (Array.from(qnaData.keys()).length >= txt.replace("Choose Question", "").trim()) {
          currentQuestionID = txt.replace("Choose Question", "").trim();
        } else {
          context.sendActivity(`There is no question ${txt.replace("Choose Question", "").trim()}. `);
        }
      }
      else if (txt.startsWith("Answer")) {
        var user = members.find(member => context.activity.from.name === member.name);

        if (!isTimeout[currentQuestionID - 1] && !isEnd[currentQuestionID - 1]) {
          if (question != undefined) {
            let isFound = false;
            let maxAttempt = (attemptList[currentQuestionID - 1] == 0) ? 1 : attemptList[currentQuestionID - 1];
            if(currentQuestionID != undefined){
              for (let i = 0; i < qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1]).length; i++) {
                if (qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1])[i].userName == user.name) {
                  if (qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1])[i].answerCount < maxAttempt) {
                    qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1])[i].value = txt;
                    qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1])[i].answerCount = qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1])[i].answerCount + 1;
                  } else {
                    context.sendActivity(`You only have ${maxAttempt} attempts!`)
                  }
                  isFound = true;
                  break;
                }
              }
  
              if (!isFound) {
                const currentAnswer = new Answer();
                currentAnswer.answerCount += 1;
                //currentAnswer.answerCount = currentAnswer.answerCount + 1;
                currentAnswer.value = txt;
                currentAnswer.userName = context.activity.from.name;
                currentAnswer.lecturerName = lecturerName;
                currentAnswer.userID = user.email.substring(0, user.email.indexOf("@"));
                currentAnswer.lecturerMail = lecturerMail;
                currentAnswer.localTimestamp = context.activity.timestamp.toLocaleString();
                qnaData.get(Array.from(qnaData.keys())[currentQuestionID - 1]).push(currentAnswer);
              }
            } else {
              context.sendActivity("Please choose 1 question to answer.");
            } 
          } else {
            context.sendActivity("There is currently no question to answer.");
          }
        } else {
          context.sendActivity("This question has been closed. Can not receive answer anymore!");
        }
      }
      else if (txt.startsWith("Result for question")) {
        if (Array.from(qnaData.keys()).length >= txt.replace("Result for question", "").trim().split(" ")[0]){
          let correct = txt.replace("Result for question", "").trim().split(" ");
          //1 asodkoaskdpokaso
          let correctID = correct.shift();
          correctList[correctID - 1] = correct.join(" ");
        } else {
          context.sendActivity("There is no question to add this result");
        }     
      }
      else if (txt.startsWith("End Question")) {
        // if(!user.email.includes("student")){
        if (Array.from(qnaData.keys()).length >= txt.replace("End Question", "").trim()){
          let endQuestionID = txt.replace("End Question", "").trim();
          isEnd[endQuestionID - 1] = true;
          // questionExist = false;
          isTimeout[endQuestionID - 1] = false;
          // clearTimeout(isTimeout); //stop timeout
          // answer.sort((a, b) => (a.localTimestamp < b.localTimestamp) ? -1 : ((a.localTimestamp > b.localTimestamp) ? 1 : 0));
          // qnaData.set(question, answer);
          // answer = [];
          context.sendActivity("Answers for this Question have been collected. Any others after this line are not accepted!")
        } else{
          context.sendActivity("This question does not exist to be closed.");
        }

        // }
        // else{
        // context.sendActivity("@" + user.name + " you are not the lecturer");
        // }
      }
      else if (txt.startsWith("End all")) {
        for (let i = 0; i < isEnd.length; i++) {
          isEnd[i] = true;
          isTimeout[i] = false;
        }
        context.sendActivity("All questions have been closed.");
      }
      else if (txt.startsWith("Compare Question")) {
        //cat cai string cua message hien tai => lay cai index ra
        // if (Array.from(qnaData.keys()).length >= txt.replace("Compare Question", "").trim()){
          let iQuestion = txt.replace("Compare Question", "").trim();
          let cc = qnaData.get(Array.from(qnaData.keys())[iQuestion - 1]);
          let currentCorrect = correctList[iQuestion - 1];
          for (let i = 0; i < cc.length; i++) {
            if (cc[i].value.includes(currentCorrect)) {
              context.sendActivity(cc[i].userName + " is correct");
            } else {
              context.sendActivity(cc[i].userName + " is wrong");
            }
          }
        // } else{
        //   context.sendActivity("This question does not exist to compare.");
        // }   
      }
      else if (txt.startsWith("Show Question")) {
        if (Array.from(qnaData.keys()).length >= txt.replace("Show Question", "").trim()){
          let iQuestion = txt.replace("Show Question", "").trim();
          let cc = qnaData.get(Array.from(qnaData.keys())[iQuestion - 1]);
          // sau do bien cc nay thanh json 
          await context.sendActivity(Array.from(qnaData.keys())[iQuestion - 1]);
          for (let i = 0; i < cc.length; i++) {
            await context.sendActivity(`\r\n
        ${cc[i].userName} - ${cc[i].userID}: ${cc[i].value} `);
            // roi output ra 
          }
        } else {
          context.sendActivity("This question does not exist to be showed.");
        }
      }
      else if (txt.startsWith("show")){
        if(Array.from(qnaData.keys()).length != 0){
          for (let i = 0; i < Array.from(qnaData.keys()).length; i++){
            await context.sendActivity((i+1) + ": " + "\n" + Array.from(qnaData.keys())[i]);
          }
        } else {
          context.sendActivity("No question to show");
        }
      }




      // if (removedMentionText) {
      //   // Remove the line break
      //   txt = removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim();
      // }


      // Trigger command by IM text
      switch (txt) {
        case "welcome": {
          const card = this.renderAdaptiveCard(rawWelcomeCard);
          await context.sendActivity({ attachments: [card] });
          break;
        }
        case "learn": {
          this.likeCountObj.likeCount = 0;
          const card = this.renderAdaptiveCard(rawLearnCard, this.likeCountObj);
          await context.sendActivity({ attachments: [card] });
          break;
        }
        /**
         * case "yourCommand": {
         *   await context.sendActivity(`Add your response here!`);
         *   break;
         * }
         */
        case "help": {
          const card = this.renderAdaptiveCard(rawHelpcard);
          await context.sendActivity({ attachments: [card] });
          break;
        }
        //record into text files
        case "export": {
          const obj = Object.fromEntries(qnaData);
          context.sendActivity(require('os').homedir);
          await fs.writeFile("./answer.txt", JSON.stringify(obj, null, 5), function (err) {
            if (err) {
              console.log(err);
            }
            else {
              console.log("Output saved to /answer.txt.");
            }
          });
          break;
        }
        // case "parse": {
        //   const fs = require('fs');
        //   fs.readFile("./answerfile.txt", "utf8", (err, answerfile) => {
        //     if (err) {
        //       console.log(`Error reading file from disk: ${err}`);
        //     } else {
        //       // parse JSON string to JSON object
        //       const databases = JSON.parse(answerfile);
        //       // print all databases
        //       databases.forEach(db => {
        //         console.log(`${db.id}, ${db.value} `);
        //       });
        //     }
        //   });
        // }

        case "clear": {
          qnaData = new Map();
          isEnd = [];
          isTimeout = [];
          attemptList = [];
          correctList = [];
          currentQuestionID = "";
          context.sendActivity("All the functions have been reseted!");
        }
        //   case "show": {
        //     //lay index cua question can show trong input
        //     // cc se la list answer cua question do
        //     let cc = qnaData.get(Array.from(qnaData.keys())[0]);
        //     // sau do bien cc nay thanh json 
        //     for (let i = 0; i < cc.length; i++) {

        //       context.sendActivity(`${question} \r\n
        // ${cc[i].userName} - ${cc[i].userID}: ${cc[i].value}`);
        //     // roi output ra file
        //     }
        //     // context.sendActivity(Object.values(qnaData));
        //     break;
        //   }
        // case "compare": {
        //   let cc = qnaData.get(Array.from(qnaData.keys())[index]);
        //   for (let i = 0; i < cc.length; i++) {
        //     if (cc[i].value.includes(correct)) {
        //       context.sendActivity(cc[i].userName + " is correct");
        //     } else {
        //       context.sendActivity(cc[i].userName + " is wrong");
        //     }
        //   }
        //   break;
        // }
      }

      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    // Listen to MembersAdded event, view https://docs.microsoft.com/en-us/microsoftteams/platform/resources/bot-v3/bots-notifications for more events
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id) {
          const card = this.renderAdaptiveCard(rawWelcomeCard);
          await context.sendActivity({ attachments: [card] });
          break;
        }
      }
      await next();
    });
  }
  // Invoked when an action is taken on an Adaptive Card. The Adaptive Card sends an event to the Bot and this
  // method handles that event.
  async onAdaptiveCardInvoke(context, invokeValue) {
    // The verb "userlike" is sent from the Adaptive Card defined in adaptiveCards/learn.json
    if (invokeValue.action.verb === "userlike") {
      this.likeCountObj.likeCount++;
      const card = this.renderAdaptiveCard(rawLearnCard, this.likeCountObj);
      await context.updateActivity({
        type: "message",
        id: context.activity.replyToId,
        attachments: [card],
      });
      return { statusCode: 200 };
    }
  }



  // Bind AdaptiveCard with data
  renderAdaptiveCard(rawCardTemplate, dataObj) {
    const cardTemplate = new ACData.Template(rawCardTemplate);
    const cardWithData = cardTemplate.expand({ $root: dataObj });
    const card = CardFactory.adaptiveCard(cardWithData);
    return card;
  }

}
// class Correct {
//   // Constructor
//   constructor() {
//     this.value = "";

//   }
// }
class Answer {
  // Constructor
  constructor() {
    this.value = "";
    this.userName = "";
    this.userID = "";
    this.lecturerName = "";
    this.lecturerMail = "";
    this.localTimestamp = "";
    this.answerCount = 0;
  }
}



module.exports.TeamsBot = TeamsBot;
