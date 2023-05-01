import { SkillBuilders } from 'ask-sdk';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';

import { LaunchRequestHandler,
          HelpIntentHandler, CancelAndStopIntentHandler, SessionEndedRequestHandler,
          AlexaErrorHandler,
          ListsIntentHandler,
          ChangeListGroupIntentHandler,
          ListGroupsIntentHandler,
          DefaultListGroupIntentHandler,
          AddItemToListIntentHandler,
          ChangeListIntentHandler,
          } from './intents';
import { dbStartup } from './dbstartup';

export const alexaPort = (process.env.ALEXA_PORT == undefined) ? 3000 : process.env.ALEXA_PORT;

const app = express();
const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    ListsIntentHandler,
    ListGroupsIntentHandler,
    ChangeListGroupIntentHandler,
    ChangeListIntentHandler,
    DefaultListGroupIntentHandler,
    AddItemToListIntentHandler
  )
  .addErrorHandlers(AlexaErrorHandler)
;
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

dbStartup()

app.post('/', adapter.getRequestHandlers());
app.listen(alexaPort, () => {console.log("Listening on port "+alexaPort+" ...")});