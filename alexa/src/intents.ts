import {
    ErrorHandler,
    HandlerInput,
    RequestHandler,
    getSlot,
  } from 'ask-sdk';

import {
    Response,
    SessionEndedRequest,
} from 'ask-sdk-model';

import { getListGroups, getLists, getUserInfo, getCouchUserInfo,
         getDynamicIntentDirective, 
         getDefaultListGroup, getListsText, getListGroupsText, getSelectedSlotInfo, getUserSettings} from "./handlercalls";
import { SlotInfo , CouchUserInfo, CouchUserInit, SettingsResponse} from "./datatypes";
import { GlobalSettings, ListGroupDocs } from './DBSchema';


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
        const userInfo = await getUserInfo(accessToken);
        let couchUserInfo : CouchUserInfo = CouchUserInit;
        if (userInfo.success) {
          couchUserInfo = await getCouchUserInfo(userInfo.email);
        }
        let dynamicDirective: any = null;
        if (!userInfo.success || !couchUserInfo.success) {
          speechText = "Welcome to Specifically Clementines. An error was encountered finding the user account."
        } else {
          speechText = 'Welcome to Specifically Clementines! '+userInfo.name+',ask me about shopping lists!';
          let listGroups = await getListGroups(couchUserInfo.userName);
          let defaultListGroup  = getDefaultListGroup(listGroups);
          let lists = await getLists(couchUserInfo.userName,listGroups);
          let userSettings: SettingsResponse = await getUserSettings(couchUserInfo.userName);
          let { attributesManager } = handlerInput;
          let sessionAttributes = attributesManager.getSessionAttributes();
          dynamicDirective = await getDynamicIntentDirective(listGroups,lists);
          sessionAttributes.dbusername = couchUserInfo.userName;
          sessionAttributes.listGroups = listGroups;
          sessionAttributes.defaultListGroupID = defaultListGroup?._id;
          sessionAttributes.lists = lists;
          sessionAttributes.settings = userSettings.settings;
          attributesManager.setSessionAttributes(sessionAttributes);
        }

        console.log("dynamic",dynamicDirective,"speech",speechText);
        return handlerInput.responseBuilder
          .speak(speechText)
          .addDirective(dynamicDirective)
          .getResponse();
      }    
    },
  };  
  
export const ChangeListGroupIntentHandler: RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'ChangeListGroupIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager, requestEnvelope } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    let listGroups: ListGroupDocs = sessionAttributes.listGroups;
    let speechText = "";
    let listGroupSlot = getSlot(requestEnvelope,"listgroup");
    if (listGroupSlot !== null) {
      let selectedListGroup = getSelectedSlotInfo(listGroupSlot);
      if (selectedListGroup.id !== null) {
        let foundListGroup = listGroups.find((lg) => (lg._id === selectedListGroup.id));
        if (foundListGroup !== undefined) {
          speechText = "Changing list group to "+foundListGroup.name;
          sessionAttributes.defaultListGroupID = foundListGroup._id;
        } else {speechText = "Could not find list group to switch to"}
      } else {
        speechText = "Could not find list group to switch to";
      }
    } else {
      speechText = "No selected list groups available to switch to";
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('List Group Change', speechText)
      .getResponse();
  },

}

export const AddItemToListIntentHandler: RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'AddItemToListIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager, requestEnvelope } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    let speechText = "";
    let itemSlot = getSlot(requestEnvelope,"item");
    let listSlot = getSlot(requestEnvelope,"list");
    if (itemSlot !== null) {
      let selectedItem = getSelectedSlotInfo(itemSlot);
      speechText = "Added "+selectedItem.name+" to the list";
    } else {
      speechText = "No item available to add";
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Added items', speechText)
      .getResponse();
  },
}

export const ListsIntentHandler : RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'ListsIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    const listText = await getListsText(sessionAttributes.lists);
    let speechText = "";
    if (sessionAttributes.lists.length === 0) {
      speechText = "There are no available lists. Please create one in the app before proceeding."
    } else {
      speechText = "The available lists are "+listText;
    }  

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Lists', speechText)
      .getResponse();
  },
};

export const ListGroupsIntentHandler : RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'ListGroupsIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    const listText = await getListGroupsText(sessionAttributes.listGroups);
    let speechText = "";
    if (sessionAttributes.listGroups.length === 0) {
      speechText = "There are no available list groups"
    } else { 
      speechText = "The available list groups are "+listText;
    }  
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard("List Groups",speechText)
      .getResponse();
  },
};

export const DefaultListGroupIntentHandler : RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'DefaultListGroupIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    let listGroups : ListGroupDocs = sessionAttributes.listGroups;
    let defaultListGroupID = sessionAttributes.defaultListGroupID;
    let speechText = "";
    let defaultListGroup = listGroups?.find(lg => (lg._id === defaultListGroupID));
    if (defaultListGroup === undefined) {
      speechText = "Not default list group available. Please check the app."
    } else {
      speechText = "The default list group is "+defaultListGroup.name;
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard("List Groups",speechText)
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
      console.log("input:",JSON.stringify(handlerInput,null,4));
  
      return handlerInput.responseBuilder
        .speak('Sorry, I don\'t understand your command. Please say it again.')
        .reprompt('Sorry, I don\'t understand your command. Please say it again.')
        .getResponse();
    }
  };
  