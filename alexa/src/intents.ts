import {
    ErrorHandler,
    HandlerInput,
    RequestHandler,
    getApiAccessToken,
    getSlot,
    getSlotValue,
  } from 'ask-sdk';

import {
    IntentRequest,
    Response,
    SessionEndedRequest,
} from 'ask-sdk-model';

import { getListGroups, getLists, getUserInfo, getCouchUserInfo,
         getDynamicIntentDirective, 
         getDefaultListGroup, getListsText, getListGroupsText,
         getSelectedSlotInfo, getUserSettings, addItemToList} from "./handlercalls";
import { SlotType,CouchUserInfo, CouchUserInit, SettingsResponse, SimpleListGroups, SimpleLists} from "./datatypes";
import { en_translations } from './locales/en/translation';
import { de_translations } from './locales/de/translation';
import { es_translations } from './locales/es/translation';
import { getSlotValueV2 } from 'ask-sdk-core';
import { isEmpty } from 'lodash';
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

export const LocalizationInterceptor = {
  async process(handlerInput: HandlerInput) {
      const localizationClient = await i18n.use(sprintf).init({
          lng: handlerInput.requestEnvelope.request.locale,
          fallbackLng: 'en', // fallback to EN if locale doesn't exist
          resources: {
            en: { translation: en_translations },
            de: { translation: de_translations },
            es: { translation: es_translations }
            }
      });
      const attributes = handlerInput.attributesManager.getRequestAttributes();
      attributes.t = function (...args: any) {
        return localizationClient.t(...args)
      }
  },
};

export const LaunchRequestHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'LaunchRequest';        
    },
    async handle(handlerInput : HandlerInput) : Promise<Response> {
      const { accessToken } = handlerInput.requestEnvelope.context.System.user;
      let speechText = "";
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
          let [defaultListID,lists] = await getLists(couchUserInfo.userName,listGroups);
          let userSettings: SettingsResponse = await getUserSettings(couchUserInfo.userName);
          let { attributesManager } = handlerInput;
          let sessionAttributes = attributesManager.getSessionAttributes();
          let requestAttributes = attributesManager.getRequestAttributes();
          speechText += requestAttributes.t('general.take_picture_for_item');
          dynamicDirective = await getDynamicIntentDirective(listGroups,lists);
          sessionAttributes.dbusername = couchUserInfo.userName;
          sessionAttributes.listGroups = listGroups;
          sessionAttributes.currentListGroupID = defaultListGroup?._id;
          sessionAttributes.currentListID = defaultListID;
          sessionAttributes.listMode = "G";
          sessionAttributes.lists = lists;
          sessionAttributes.settings = userSettings.settings;
          attributesManager.setSessionAttributes(sessionAttributes);
        }
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
    let listGroups: SimpleListGroups = sessionAttributes.listGroups;
    let speechText = "";
    let listGroupSlot = getSlot(requestEnvelope,"listgroup");
    if (listGroupSlot !== null) {
      let [slotType,selectedListGroup] = getSelectedSlotInfo(listGroupSlot);
      console.log("listgroup selected:",slotType,selectedListGroup);
      if (slotType == SlotType.Static && selectedListGroup.id == "sys:listgroup:default") {
        let foundListGroup = listGroups.find(l => (l._id === sessionAttributes.currentListGroupID))
        if (foundListGroup === undefined) {
          speechText = "The current list group is invalid"
        } else { speechText = "The current list group is already "+foundListGroup.name }
      } else if (selectedListGroup.id !== null) {
        console.log("trying to find listgroup in listgroups: ", listGroups);
        let foundListGroup = listGroups.find((lg) => (lg._id === selectedListGroup.id));
        if (foundListGroup !== undefined) {
          speechText = "Changing list group to "+foundListGroup.name;
          sessionAttributes.currentListGroupID = foundListGroup._id;
          sessionAttributes.listMode = "G";
          attributesManager.setSessionAttributes(sessionAttributes);
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

export const ChangeListIntentHandler: RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'ChangeListIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager, requestEnvelope } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    let lists: SimpleLists = sessionAttributes.lists;
    let speechText = "";
    let listSlot = getSlot(requestEnvelope,"list");
    if (listSlot !== null) {
      let [slotType,selectedList] = getSelectedSlotInfo(listSlot);
      console.log("list selected:",slotType,selectedList);
      if (selectedList.id !== null) {
        if (slotType == SlotType.Static && selectedList.id == "sys:list:default") {
          let foundList = lists.find(l => (l._id === sessionAttributes.currentListID))
          if (foundList === undefined) {
            speechText = "The current list is invalid"
          } else { speechText = "The current list is already "+foundList.name }
        } else if (selectedList.id !== null) {
          let foundList = lists.find((lg) => (lg._id === selectedList.id));
          if (foundList !== undefined) {
            speechText = "Changing list to "+foundList.name;
            sessionAttributes.currentListGroupID = foundList._id;
            sessionAttributes.listMode = "L";
            attributesManager.setSessionAttributes(sessionAttributes);
          } else {speechText = "Could not find list to switch to"}          
        } else { speechText = "Could not find list to switch to";}
      }  
    } else {
      speechText = "No selected list lists available to switch to";
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('List Change', speechText)
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
    console.log("Request:",JSON.stringify((requestEnvelope.request as IntentRequest).intent,null,2));
    let sessionAttributes = attributesManager.getSessionAttributes();
    let speechText = "";
    let itemSlot = getSlot(requestEnvelope,"item");
    let [itemSlotType,selectedItem] = getSelectedSlotInfo(itemSlot);
    let itemSlotValue = getSlotValue(requestEnvelope,"item");
    let itemSlotValueV2 = getSlotValueV2(requestEnvelope,"item");
    let addNoMatchSlot = getSlot(requestEnvelope,"addnomatch");
    let [addNoMatchSlotType,addNoMatchItem] = getSelectedSlotInfo(addNoMatchSlot);
    console.log("item slot value:",itemSlotValue," v2:",itemSlotValueV2);
    if (itemSlotType == SlotType.None && !isEmpty(itemSlotValue) && addNoMatchSlotType !== SlotType.Static && addNoMatchItem.id !== "sys:yes") {
        speechText="Do you really want to add "+itemSlotValue+" to the list?";
        return handlerInput.responseBuilder
        .speak(speechText)
        .addElicitSlotDirective("addnomatch")
        .withSimpleCard("Really?", speechText)
        .getResponse();

    }
    let listSlot = getSlot(requestEnvelope,"list");
    let listGroupSlot = getSlot(requestEnvelope,"listgroup");
    let accessToken = getApiAccessToken(requestEnvelope);
    let itemAddResults = await addItemToList({ itemSlot,itemSlotValue, listSlot,listGroupSlot,defaultListGroupID: sessionAttributes.currentListGroupID,
        defaultListID: sessionAttributes.currentListID, listMode: sessionAttributes.listMode,
        lists:sessionAttributes.lists, listGroups: sessionAttributes.listGroups,
        settings: sessionAttributes.settings,accessToken});
    let dynamicDirective = await getDynamicIntentDirective(sessionAttributes.listGroups,sessionAttributes.lists);
    if (dynamicDirective === null) {
      speechText = "No lists available. Item not added."
      return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Error adding items', speechText)
      .getResponse();
    }
    speechText = itemAddResults.message;
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Added items', speechText)
      .addDirective(dynamicDirective)
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
    let listGroups :SimpleListGroups = sessionAttributes.listGroups;
    let currentListGroupID = sessionAttributes.currentListGroupID;
    let speechText = "";
    let currentListGroup = listGroups?.find(lg => (lg._id === currentListGroupID));
    if (currentListGroup === undefined) {
      speechText = "No current list group available. Please check the app."
    } else {
      speechText = "The current list group is "+currentListGroup.name;
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard("List Groups",speechText)
      .getResponse();
  },
};

export const DefaultListIntentHandler : RequestHandler = {
  canHandle(handlerInput : HandlerInput) : boolean {
    const request = handlerInput.requestEnvelope.request;  
    return request.type === 'IntentRequest'
      && request.intent.name === 'DefaultListIntent';
  },
  async handle(handlerInput : HandlerInput) : Promise<Response> {
    let { attributesManager } = handlerInput;
    let sessionAttributes = attributesManager.getSessionAttributes();
    let lists : SimpleLists = sessionAttributes.lists;
    let currentListID = sessionAttributes.currentListID;
    let speechText = "";
    let currentList = lists?.find(l => (l._id === currentListID));
    if (currentList === undefined) {
      speechText = "No current list available. Please check the app."
    } else {
      speechText = "The current list is "+currentList.name;
    }
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard("Lists",speechText)
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
      const speechText = 'You can ask me about lists, list groups, or add an item to your list!';
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('Ask me about Shopping', speechText)
        .getResponse();
    },
  };

  export const AmazonFallbackIntentHandler : RequestHandler = {
    canHandle(handlerInput : HandlerInput) : boolean {
      const request = handlerInput.requestEnvelope.request;    
      return request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.Fallback';
    },
    handle(handlerInput : HandlerInput) : Response {
      const speechText = 'Ask me about shopping lists. Fallback.';
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('Ask me about shopping lists. Fallback.', speechText)
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
  