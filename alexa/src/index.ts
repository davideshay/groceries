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
          DefaultListIntentHandler,
          LocalizationInterceptor,
          } from './intents';
import { dbStartup } from './dbstartup';
import log from 'loglevel';

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
    DefaultListIntentHandler,
    AddItemToListIntentHandler
  )
  .addErrorHandlers(AlexaErrorHandler)
  .addRequestInterceptors(LocalizationInterceptor)
;
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

dbStartup()

app.post('/', adapter.getRequestHandlers());
app.listen(alexaPort, () => {log.info("Listening on port "+alexaPort+" ...")});