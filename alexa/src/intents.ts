import {
    ErrorHandler,
    HandlerInput,
    RequestHandler
  } from 'ask-sdk';

import {
    Response,
    SessionEndedRequest,
} from 'ask-sdk-model';

import { getListGroups, getLists, getUserInfo } from "./handlercalls";
import { Console } from 'console';

export const LaunchRequestHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'LaunchRequest';        
    },
    async handle(handlerInput : HandlerInput) : Promise<Response> {
      const { accessToken } = handlerInput.requestEnvelope.context.System.user;
      let speechText = 'Welcome to Specifically Clementines! Ask me about shopping lists!';
      
      if (!accessToken) {
        speechText = 'You must authenticate with your Amazon Account to use Specifically Clementines. I sent instructions for how to do this in your Alexa App';
        return handlerInput.responseBuilder
          .speak(speechText)
          .withLinkAccountCard()
          .getResponse();
      } else {
        console.log("launching, access token is:",accessToken);
        const userInfo = await getUserInfo(accessToken);
        console.log(userInfo);
        speechText = 'Welcome to Specifically Clementines!'+userInfo.name+'Ask me about shopping lists!';
        return handlerInput.responseBuilder
          .speak(speechText)
          .getResponse();
      }    
    },
  };  
  
export const AskWeatherIntentHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;  
      return request.type === 'IntentRequest'
        && request.intent.name === 'AskWeatherIntent';
    },
    async handle(handlerInput : HandlerInput) : Promise<Response> {
      const listGroupText = await getListGroups("davideshay");
      const speechText = "The available list groups are "+listGroupText;
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('The weather today is sunny.', speechText)
        .getResponse();
    },
  };

export const ListsIntentHandler : RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'ListsIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    const listText = await getLists("davideshay");
    const speechText = "The available lists are "+listText;

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('The weather today is sunny.', speechText)
      .getResponse();
  },
};
  
export const HelpIntentHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;    
      return request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput : HandlerInput) : Response {
      const speechText = 'You can ask me the weather!';
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('You can ask me the weather!', speechText)
        .getResponse();
    },
  };
  
export const CancelAndStopIntentHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'
        && (request.intent.name === 'AMAZON.CancelIntent'
           || request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput : HandlerInput) : Response {
      const speechText = 'Goodbye!';
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Goodbye!', speechText)
        .withShouldEndSession(true)      
        .getResponse();
    },
  };
  
export const SessionEndedRequestHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;    
      return request.type === 'SessionEndedRequest';
    },
    handle(handlerInput : HandlerInput) : Response {
      console.log(`Session ended with reason: ${(handlerInput.requestEnvelope.request as SessionEndedRequest).reason}`);
  
      return handlerInput.responseBuilder.getResponse();
    },
  };
  
export const AlexaErrorHandler : ErrorHandler = {
    canHandle(handlerInput : HandlerInput, error : Error ) : boolean {
      return true;
    },
    handle(handlerInput : HandlerInput, error : Error) : Response {
      console.log(`Error handled: ${error.message}`);
  
      return handlerInput.responseBuilder
        .speak('Sorry, I don\'t understand your command. Please say it again.')
        .reprompt('Sorry, I don\'t understand your command. Please say it again.')
        .getResponse();
    }
  };
  