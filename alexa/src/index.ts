import { SkillBuilders } from 'ask-sdk';
import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';

import { LaunchRequestHandler, AskWeatherIntentHandler,
          HelpIntentHandler, CancelAndStopIntentHandler, SessionEndedRequestHandler,
          AlexaErrorHandler,
          ListsIntentHandler,
          ChangeListGroupIntentHandler} from './intents';
import { dbStartup } from './dbstartup';

const app = express();
const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskWeatherIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    ListsIntentHandler,
    ChangeListGroupIntentHandler
  )
  .addErrorHandlers(AlexaErrorHandler)
;
const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, true, true);

dbStartup()

app.post('/', adapter.getRequestHandlers());
app.listen(3000, () => {console.log("Listening on port 3000...")});