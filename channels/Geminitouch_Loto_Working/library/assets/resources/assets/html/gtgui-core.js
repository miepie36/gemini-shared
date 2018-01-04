/*
 *
 * This item is the property of IGT Corporation, Providence,
 * Rhode Island, and contains confidential and trade secret information.
 * It may not be transferred from the custody or control of IGT except
 * as authorized in writing by an officer of IGT.  Neither this item
 * nor the information it contains may be used, transferred, reproduced,
 * published, or disclosed, in whole or in part, and directly or
 * indirectly, except as expressly authorized by an officer of IGT,
 * pursuant to written agreement.
 *
 * Copyright (c) 2014, 2015 IGT Corporation.  All rights reserved.
 *
 */

//------------------------------------------------------------------------------
// Get/create the top level namespace
var GTGUI = GTGUI || {};

//------------------------------------------------------------------------------
GTGUI.DEVICE_RESPONSE = {

    LOGIN_RESPONSE: "LOGIN_RESPONSE",
    BIN_GAME_RESPONSE: "BIN_GAME_RESPONSE",
    ONLINE_GAME_RESPONSE: "ONLINE_GAME_RESPONSE",
    TERMINAL_CONFIGURATION_RESPONSE: "TERMINAL_CONFIG_RESPONSE",
    VEND_ONLINE_RESPONSE: "VEND_ONLINE_RESPONSE",
    ENABLE_CASHLESS_DEVICES_RESPONSE: "ENABLE_CASHLESS_DEVICES_RESPONSE",
    INITIATE_CASHLESS_TRANSACTION_RESPONSE: "INITIATE_CASHLESS_TRANSACTION_RESPONSE",
    VEND_ONLINE_BETSLIP_RESPONSE: "VEND_ONLINE_BETSLIP_RESPONSE",
    VEND_INSTANT_TICKET_RESPONSE: "VEND_INSTANT_TICKET_RESPONSE",
    TICKET_INQUIRY_RESPONSE: "TICKET_INQUIRY_RESPONSE",
    INSTANT_INQUIRY_RESPONSE: "INSTANT_INQUIRY_RESPONSE",
    ONLINE_VALIDATION_RESPONSE: "ONLINE_VALIDATION_RESPONSE",
    INSTANT_VALIDATION_RESPONSE: "INSTANT_VALIDATION_RESPONSE",
    REQUEST_MANUAL_QP_ONLINE_RESPONSE: "REQUEST_MANUAL_QP_ONLINE_RESPONSE",
    REFUND_RESPONSE: "REFUND_RESPONSE"
};

//------------------------------------------------------------------------------
GTGUI.DEVICE_EVENT = {
// CASHLESS: cashless event created and day end event
// Day end event still WIP
    CREDIT_EVENT: "CREDIT_EVENT",
    DEVICE_STATUS_EVENT: "DEVICE_STATUS_EVENT",
    ONLINE_GAME_EVENT: "ONLINE_GAME_EVENT",
    STATUS_MANAGER_EVENT: "STATUS_MANAGER_EVENT",
    VEND_EVENT: "VENDING_EVENT",
    CONFIGURATION_EVENT: "CONFIGURATION_EVENT",
    CASHLESS_EVENT: "CASHLESS_EVENT",
    DAY_END_EVENT: "DAY_END_EVENT",
    AGE_EVENT: "AGE_EVENT",
    REMOTE_MODULE_EVENT: "REMOTE_MODULE_EVENT"
};

//------------------------------------------------------------------------------
GTGUI.LAYOUT_EVENT = {

    LAYOUT_EVENT: "LAYOUT_EVENT",
    GAME_SELECTED: "GAME_SELECTED",
    ENABLE_CASHLESS: "ENABLE_CASHLESS",
    INITIATE_CASHLESS_TRANSACTION: "INITIATE_CASHLESS_TRANSACTION",
    END_CASHLESS_SESSION: "END_CASHLESS_SESSION",
    PLAY_SOUND: "PLAY_SOUND",
    START_ATTRACT_SHOW: "START_ATTRACT_SHOW",
    STOP_ATTRACT_SHOW: "STOP_ATTRACT_SHOW",
    AGE_VERIFICATION_TIMEOUT: "AGE_VERIFICATION_TIMEOUT",
    ADD_CREDIT: "ADD_CREDIT",
    WAGER_CONFIRMATION: "WAGER_CONFIRMATION",
    REINVEST_CONFIRMATION: "REINVEST_CONFIRMATION",
    REQUEST_MANUAL_QP_ONLINE: "REQUEST_MANUAL_QP_ONLINE",
    ISSUE_REFUND: "ISSUE_REFUND",
    ISSUE_CASHLESS_RECEIPT: "ISSUE_CASHLESS_RECEIPT",
    LANGUAGE_EVENT: "LANGUAGE_EVENT"
};

//------------------------------------------------------------------------------
GTGUI.GAME_TYPE = {

    ONLINE: "ONLINE",
    INSTANT: "INSTANT"
};

/*
 *
 * @param {type} obj
 * @returns {GTGUI.ObjectCopy.obj}
 */
GTGUI.ObjectCopy = function(obj) {

    var property;
    var copy = {};

    for (property in obj) {

        if (obj.hasOwnProperty(property)) {

            copy[property] = obj[property];
        }
    }

    return copy;
};

/*
 *
 * @param {type} obj1
 * @param {type} obj2
 * @returns {undefined}
 */
GTGUI.ObjectMerge = function(obj1, obj2) {

    var property;

    for (property in obj2) {

        if (obj2.hasOwnProperty(property)) {

            obj1[property] = obj2[property];
        }
    }
};

/*
 *
 * @param {type} type
 * @param {type} action
 * @param {type} details
 * @returns {undefined}
 */
GTGUI.ObservableEvent = function(type, action, details) {

    this.type = type || "";
    this.action = action || "";
    this.details = details || null;
};

/*
 * Observable
 *
 */
GTGUI.Observable = function() {

    this._listeners = {};
};

GTGUI.Observable.prototype = {

    addListener: function(type, listener) {

        if (typeof this._listeners[type] === "undefined") {

            this._listeners[type] = [];
        }

        this._listeners[type].push(listener);
    },
    dispatchEvent: function(observableEvent) {

        if (this._listeners[observableEvent.type] instanceof Array) {

            var listeners = this._listeners[observableEvent.type];

            for (var i = 0, len = listeners.length; i < len; i++) {

                listeners[i].call(this, observableEvent);
            }
        }
    },
    removeListener: function(type, listener) {

        if (this._listeners[type] instanceof Array) {

            var listeners = this._listeners[type];

            for (var i = 0, len = listeners.length; i < len; i++) {

                if (listeners[i] === listener) {
                    listeners.splice(i, 1);
                    break;
                }
            }
        }
    }
};

//------------------------------------------------------------------------------
/*
 * Main object
 *
 */
GTGUI.Main = function() {

    GTGUI.Observable.call(this);

    // Support classes
    var _websocketComm = null;
    var _webSocketAddress = "";
    var _guiLayout = null;
    var _useLayout = null;
    var _request = null;

    var deviceInfo = {

        credits: 0,
        deviceStatus: "enabled",
        printerStatus: "noError",
        billAcceptorStatus: "notAvailable",
        coinAcceptorStatus: "notAvailable",
        onlineGames: [],
        binGames: [],
        samplers: [],
        configuration : {}
    };

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (_guiLayout) {

            _guiLayout.removeListener(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, layoutEvent);
            _guiLayout.remove();
            _guiLayout = null;
        }

        if (_websocketComm !== null) {

            _websocketComm.removeListener(GTGUI.Main.COMM_EVENT.COMM_EVENT, commEvent);
            _websocketComm.remove();
            _websocketComm = null;
        }
    };

    /*
     *
     * @param {type} useLayout
     * @param {type} configFile
     * @param {type} standalone
     * @returns {undefined}
     */
    this.create = function(useLayout, configFile)
    {
        _useLayout = useLayout;
        loadConfigurationData(configFile);
    };

    /*
     *
     * @param {type} configFile
     * @returns {Boolean}
     */
    function loadConfigurationData(configFile)
    {
        var request = _request = new XMLHttpRequest();
        request.onreadystatechange = processConfigurationData;
        request.open("GET", configFile, true); // true for asynchronous
        request.send();
        return true;
    };

    /*
     *
     * @returns {Boolean}
     */
    function processConfigurationData()
    {
        var games, index, game, data, property;

        if (_request.readyState === 4 && _request.status === 200) {

            data = JSON.parse(_request.responseText);

            // Create online games.
            games = data.core.onlineGames;

            for (index = 0; index < games.length; index++) {

                game = {};

                // The defaults
                game.gameType = GTGUI.GAME_TYPE.ONLINE;
                game.currentInventory = 0;
                game.gameId = games[index].gameId;
                game.onlineGameId = games[index].onlineGameId;

                deviceInfo.onlineGames.push(game);
            }

            // Create instant games.
            games = data.core.binGames;

            for (index = 0; index < games.length; index++) {

                game = {};

                // The defaults
                game.gameType = GTGUI.GAME_TYPE.INSTANT;
                game.binNumber = (index + 1);
                game.gameId = parseInt(games[index].gameId);
                game.ticketPrice = games[index].ticketPrice;
                game.currentInventory = parseInt(games[index].currentInventory);
                game.binStatus = setBinStatus(games[index].binStatus);

                deviceInfo.binGames.push(game);
            }

            // Get the other core settings
            _webSocketAddress = data.core.webSocketAddress;

            // Get the layout settings, but set to the layout not the instance
            for (property in data.layout) {

                _useLayout[property] = Number(data.layout[property]) || data.layout[property];
            }

            if (_useLayout) {

                _guiLayout = new _useLayout;
                _guiLayout.addListener(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, layoutEvent);

                if (_guiLayout.create()) {

                    _websocketComm = new GTGUI.Main.Comm();

                    // Create _websocketComm
                    if (_websocketComm !== null) {

                        _websocketComm.addListener(GTGUI.Main.COMM_EVENT.COMM_EVENT, commEvent);

                        if (_websocketComm.create(_webSocketAddress)) {

                            postEvent(GTGUI.DEVICE_EVENT.DEVICE_STATUS_EVENT, null);
                            return true;
                        }
                        else {

                          console.log("GUI - Failed to create GUI comm");
                        }

                        _websocketComm.remove();
                    }
                    else {

                      console.log("GUI - Failed to create GUI comm instance");
                    }

                    _websocketComm = null;
                }
                else {

                    console.log("GUI - Failed to create GUI layout");
                }

                _guiLayout.remove();
            }
            else {

              console.log("GUI - Failed to create GUI layout instance");
            }

            _guiLayout = null;
            return false;
        }
    };

    /*
     *
     * @param {type} observableEvent
     * @returns {undefined}
     */
    function commEvent(observableEvent) {

        switch (observableEvent.action) {

            case GTGUI.Main.COMM_EVENT.CONNECTED:

                console.log("commEvent: " + observableEvent.action);
                // Send default language selection
                var object = {message: {arg: [{name : "origin", type : "string", content : "ImplicitPlayer"}]}};
                object.message.arg.push({name : "event", type : "string", content : "LANGUAGE_EVENT"});
                object.message.arg.push({name : "value", type : "string", content : _useLayout["DEFAULT_LANGUAGE"]});

                if (_websocketComm !== null) {

                    _websocketComm.send(object);
                }
                break;

            case GTGUI.Main.COMM_EVENT.DISCONNECTED:

                console.log("commEvent: " + observableEvent.action);

                // Disable the device
                deviceInfo.deviceStatus = "NOT_CONNECTED";
                postEvent(GTGUI.DEVICE_EVENT.STATUS_MANAGER_EVENT, null);
                break;

            case GTGUI.Main.COMM_EVENT.MESSAGE:

                var index;
                var object;
                var messageData = {};                
                var args;
                
                // Altura formatted message
                if (observableEvent.details.hasOwnProperty("message")) {
                
                    args = observableEvent.details.message.arg;

                    // Create messageData object out of all the arg objects passed
                    for (index = 0; index < args.length; index++) {

                        object = args[index];
                        messageData[object.name] = object.content;
                    }
                }
                // NEOS formatted message
                else {

                    messageData = observableEvent.details;
                }

                // Handle the message
                messageEventHandler(messageData);
                break;

            case GTGUI.Main.COMM_EVENT.ERROR:

                console.log("commEvent: error");
                break;
        }
    };

    /*
     *
     * @param {type} messageData
     * @returns {undefined}
     */
    function messageEventHandler(messageData) {

        var messageType = null;

        // Get the message type
        messageType = messageData.action;

        if (messageType === undefined) {

            messageType = messageData.source;
        }

        console.log("Message Type: " + messageType);
        console.log(messageData);

        switch (messageType) {

            // ----------------------------------------------------------------
            // EVENTS
            // ----------------------------------------------------------------
            case "balance":

                if (messageData.event === "STATUS_CHANGE") {

                    deviceInfo.credits = parseFloat(messageData.value.substr(3));
                }

                delete messageData.source;

                postEvent(GTGUI.DEVICE_EVENT.CREDIT_EVENT, {status: messageData});
                break;

            case "statusManager":

                deviceInfo.deviceStatus = messageData.value;
                //deviceInfo.doorStatus = (messageData.isDoorOpened ? "open" : "closed");

                delete messageData.event;
                delete messageData.source;

                postEvent(GTGUI.DEVICE_EVENT.STATUS_MANAGER_EVENT, null);
                break;

            case "remoteModule":

                delete messageData.event;
                delete messageData.source;

                postEvent(GTGUI.DEVICE_EVENT.REMOTE_MODULE_EVENT, {status: messageData});
                break;

            case "deviceInfoModule":

                var property;
                var binIndex;
                
                console.log("deviceInfoModule");
                console.log(messageData);

                // Copy the properties over to the deviceInfo
                //This is used to see if we have virtual or actual bin status. Checks original bins first, THEN virtual bins
                
                for (property in messageData) {
                    
                    if(messageData.hasOwnProperty("instantVirtualBinStatus1")){
                        if(property[0] === 'i' && property[7] === 'V') {
                            binIndex = property.substr(23) - 1;

                            if (deviceInfo.binGames.length > 0 && deviceInfo.binGames[binIndex].hasOwnProperty("binStatus")) {
                               // console.log(deviceInfo.binGames);
                                deviceInfo.binGames[binIndex].binStatus = setBinStatus(messageData[property]);
                            }
                        
                        
                        }
                        else {

                            deviceInfo[property] = messageData[property];
                        }
                    } else {
                        if (property[0] === 'i' && property[7] === 'B') {

                            binIndex = property.substr(16) - 1;

                            if (deviceInfo.binGames.length > 0 && deviceInfo.binGames[binIndex].hasOwnProperty("binStatus")) {

                                deviceInfo.binGames[binIndex].binStatus = setBinStatus(messageData[property]);
                            }
                        }
                        else {

                            deviceInfo[property] = messageData[property];
                        }
                    }
                    /* else*/ 
                    
                    
                    
                }
                
                console.log(deviceInfo.binGames);
                
                

                delete messageData.event;
                delete messageData.source;

                postEvent(GTGUI.DEVICE_EVENT.DEVICE_STATUS_EVENT, null);
                break;

            case "vendingModule":

                // If there was a VENDED message, update associated bins inventory
                if (messageData.value === "VENDED") {

                    // If there is a bin defined, adjust the bin inventory
                    if (messageData.hasOwnProperty("bin")) {

                        var index = parseInt(messageData.bin) - 1;

                        deviceInfo.binGames[index].currentInventory = parseInt(messageData.currentInventory);
                    }
                }

                delete messageData.event;
                delete messageData.source;

                postEvent(GTGUI.DEVICE_EVENT.VEND_EVENT, {status: messageData});
                break;

            case "cashlessPaymentModule":
                     
                postEvent(GTGUI.DEVICE_EVENT.CASHLESS_EVENT, {status: messageData});
                break;

            // TESTING: End of day    
            case "dayEndNotificationModule":

                postEvent(GTGUI.DEVICE_EVENT.DAY_END_EVENT, {status: messageData});
                break;     

            case "onlineGameModule":

                var index;
                var gameIndex;
                var onlineGames, game;
                var values, games;

                switch (messageData.event) {

                    case "STATUS_CHANGED":

                        if (messageData.value.length > 0) {

                            values = messageData.value.substr(1, messageData.value.length - 2);

                            // If a message shows no games active, clear the samplers
                            if (values === "") {

                                deviceInfo.samplers.length = 0;
                            }

                            // Break them down to an array
                            games = values.split(", ");
                            console.log("GAMES: ");
                            console.log(games);

                            onlineGames = deviceInfo.onlineGames;
                            
                            console.log(onlineGames);

                            for (gameIndex = 0; gameIndex < onlineGames.length; gameIndex++) {

                                game = onlineGames[gameIndex];
                                game.currentInventory = 0;

                                index = games.indexOf(game.onlineGameId);

                                // Defined in the list it is active
                                if (index !== -1) {

                                    game.currentInventory = 1;
                                    games.splice(index, 1);
                                }
                            }

                            while (games.length !== 0 && values !== "") {

                                index = -1;
                                //console.log(deviceInfo.samplers);
                                for (gameIndex = 0; gameIndex < deviceInfo.samplers.length; gameIndex++) {

                                    game = deviceInfo.samplers[gameIndex];

                                    index = games.indexOf(game.onlineGameId);

                                    // Defined in the list
                                    if (index != -1) {

                                        break;
                                    }
                                }

                                // Sampler game was not found, create it
                                if (index === -1) {
                                    console.log("SAMPLER GAME NOT FOUND");
                                    console.log(games[0]);
                                    console.log(GTGUI.GAME_TYPE.SAMPLER);
                                    index = 0;
                                    //deviceInfo.samplers.push({gameType: GTGUI.GAME_TYPE.SAMPLER, gameId: "Sampler", onlineGameId: games[0], currentInventory: 1});
                                    if(deviceInfo.samplers.length === 0){
                                        deviceInfo.samplers.push({gameType: GTGUI.GAME_TYPE.SAMPLER, gameId: "Sampler", onlineGameId: "Promotions", currentInventory: 1});
                                    }
                                }
                                
                                console.log(deviceInfo.samplers);

                                // Remove the game
                                games.splice(index, 1);
                            }

                            // Find the sampler game and enable item
                            for (gameIndex = 0; gameIndex < onlineGames.length; gameIndex++) {

                                game = onlineGames[gameIndex];

                                if (game.gameId === "Sampler") {

                                    game.currentInventory = ((deviceInfo.samplers.length > 0) ? 1 : 0);
                                }
                            }
                        }
                        break;
                }

                postEvent(GTGUI.DEVICE_EVENT.ONLINE_GAME_EVENT, {status: messageData});
                break;

            case "AGE_VERIFICATION":

                delete messageData.action;

                postEvent(GTGUI.DEVICE_EVENT.AGE_EVENT, {status: messageData});
                break;

            case "STOP_ATTRACTSHOW":

                delete messageData.action;

                postEvent(GTGUI.DEVICE_EVENT.STOP_ATTRACTSHOW, {status: messageData});
                break;

            case "GET_CONFIG_INFO":

                var index, binInfo;

                //messageData.number_of_instant_bins = 28;
                deviceInfo.configuration = messageData;

                if (deviceInfo.binGames.length !== messageData.number_of_instant_bins) {

                    deviceInfo.binGames.length = 0;

                    // Create basic instant games place holders
                    for (index = 0; index < messageData.number_of_instant_bins; index++) {

                        deviceInfo.binGames.push({"gameType" : "INSTANT", "gameId" : "0", "currentInventory" : "0", "ticketPrice" : "USD0.00", "binStatus" : setBinStatus("[disabled, binNotConfigured]")});
                    }

                    binInfo = "";

                    // Assign bin numbers to the online games
                    for (index = 0; index < deviceInfo.onlineGames.length; index++) {

                        deviceInfo.onlineGames[index].binNumber = messageData.number_of_instant_bins + index + 1;

                        if (index !== 0) {

                            binInfo += ",";
                        }

                        binInfo += deviceInfo.onlineGames[index].onlineGameId + "," + deviceInfo.onlineGames[index].binNumber;
                    }

                    // Send online bin configuration to host
                    var object = {message: {arg: [{name : "origin", type : "string", content : "ImplicitPlayer"}]}};
                    object.message.arg.push({name : "action", type : "string", content : "SET_ONLINE_GAME_LOCATION"});
                    object.message.arg.push({name : "onlineGameBinMapping", type : "strings", content : "[" + binInfo + "]"});

                    if (_websocketComm !== null) {

                        _websocketComm.send(object);
                    }

                    // Create the games now that we know how many bins
                    _guiLayout.createGames(deviceInfo);
                }

                delete messageData.action;

                postEvent(GTGUI.DEVICE_EVENT.CONFIGURATION_EVENT, null);
                break;

            case "GET_ONLINE_GAME_INFO":

                //console.log(messageData.gameId);
				console.log("GET_ONLINE_GAME_INFO: ");
				//console.log(deviceInfo);
				//CAMCOMEBACK
				
                var index, game;

                if (messageData.result === "SUCCESS") {

                    for (index = 0; index < deviceInfo.onlineGames.length; index++) {

                        game = deviceInfo.onlineGames[index];

                        if (game.onlineGameId === messageData.gameId) {

                            game.parameters = GTGUI.ObjectCopy(messageData);
                            postResponse(GTGUI.DEVICE_RESPONSE.ONLINE_GAME_RESPONSE, null);
                            return;
                        }
                    }
                    
                    var neosSampler = false;
                    var neosParamsGiftPackList;
                    
                    for (index = 0; index < deviceInfo.samplers.length; index++) {

                        game = deviceInfo.samplers[index];
						
						console.log("game: ");
						console.log(game);

                        if (game.onlineGameId === messageData.gameId) {
                            //CAMCOMEBACK
                            game.parameters = GTGUI.ObjectCopy(messageData);
                            
                            if(game.parameters.hasOwnProperty("gameRuleSet")){
                                console.log("NEOS SAMPLER");
                                neosSampler = true;
                                neosParamsGiftPackList = JSON.parse(game.parameters.gameRuleSet);
                                neosParamsGiftPackList = neosParamsGiftPackList.gameRuleSet;
                                //neosParamsGiftPackList = neosParamsGiftPackList.giftPackList;
                                console.log(neosParamsGiftPackList);
                                break;
                            } else {
                                postResponse(GTGUI.DEVICE_RESPONSE.ONLINE_GAME_RESPONSE, null);
                                return;
                            }
                            
                            
                            
                            
                        }
                        
                        console.log(game);
                    }
                    
                    if(neosSampler){
                        deviceInfo.samplers = [];
                        
                        for(index = 0; index<neosParamsGiftPackList.giftPackList.length; index++){
                            var tempSampler = {};
                            
                            tempSampler.gameType = "ONLINE";
                            tempSampler.gameId = "Sampler";
                            tempSampler.onlineGameId = "NPACK"+neosParamsGiftPackList.giftPackList[index].giftPackIndex;
                            tempSampler.currentInventory = 1;
                            
                            tempSampler.parameters = {};
                            tempSampler.parameters.gameId = "NPACK"+neosParamsGiftPackList.giftPackList[index].giftPackIndex;
                            tempSampler.parameters.numberOfTickets = neosParamsGiftPackList.giftPackList[index].numberOfTickets;
                            tempSampler.parameters.ticketDetails = neosParamsGiftPackList.giftPackList[index].ticketDetails;
                            tempSampler.parameters.giftPackName = neosParamsGiftPackList.giftPackList[index].giftPackName;
                            if(neosParamsGiftPackList.giftPackList[index].hasOwnProperty("giftPackPrice")){
                                  tempSampler.parameters.giftPackPrice = neosParamsGiftPackList.giftPackList[index].giftPackPrice;
                            }
                            
                            deviceInfo.samplers.push(tempSampler);
                        }
                        
                        console.log(deviceInfo.samplers);
                        postResponse(GTGUI.DEVICE_RESPONSE.ONLINE_GAME_RESPONSE, null);
                                return;
                        
                    }
                }
                break;

            // ----------------------------------------------------------------
            // RESPONSES
            // ----------------------------------------------------------------
            case "VEND_INSTANT_TICKET":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.VEND_INSTANT_TICKET_RESPONSE, messageData);
                break;

            case "VEND_ONLINE":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.VEND_ONLINE_RESPONSE, messageData);
                break;

            // CASHLESS: Response from core after keypad amount captured
            case "INITIATE_CASHLESS_TRANSACTION":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.INITIATE_CASHLESS_TRANSACTION_RESPONSE, messageData);
                break;
            
            // CASHLESS: Response from core after cashless prompt button pressed            
            case "ENABLE_CASHLESS_DEVICES":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.ENABLE_CASHLESS_DEVICES_RESPONSE, messageData);
                break;      

            case "VEND_ONLINE_BESTSLIP":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.VEND_ONLINE_BETSLIP_RESPONSE, messageData);
                break;

            case "REQUEST_MANUAL_QP_ONLINE":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.REQUEST_MANUAL_QP_ONLINE_RESPONSE, messageData);
                break;

            case "inquiry":
            case "INSTANT_INQUIRY":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.INSTANT_INQUIRY_RESPONSE, messageData);
                break;

            case "TICKET_INQUIRY":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.TICKET_INQUIRY_RESPONSE, messageData);
                break;

            case "INSTANT_VALIDATION":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.INSTANT_VALIDATION_RESPONSE, messageData);
                break;

            case "ONLINE_VALIDATION":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.ONLINE_VALIDATION_RESPONSE, messageData);
                break;

            case "LOGIN":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.LOGIN_RESPONSE, null);
                break;

            case "REFUND":

                delete messageData.action;

                postResponse(GTGUI.DEVICE_RESPONSE.REFUND_RESPONSE, null);
                break;

            case "GET_BIN_GAME_INFO":

                if (messageData.result === "SUCCESS") {

                    var index = messageData.binNumber - 1;
                    var current = deviceInfo.binGames[index];

                    GTGUI.ObjectMerge(current, messageData);

                    // Convert to boolean statuses instead.
                    current.binStatus = setBinStatus(messageData.binStatus);

                    delete deviceInfo.binGames[index].action;

                    postResponse(GTGUI.DEVICE_RESPONSE.BIN_GAME_RESPONSE, {binIndex: index});
                }
                break;
        }
    };

    /*
     *
     * @param {type} observableEvent
     * @returns {undefined}
     */
    function layoutEvent(observableEvent) {

        var object = {message: {arg: [{name : "origin", type : "string", content : "ImplicitPlayer"}]}};
        var argObj;

        switch (observableEvent.action) {

            case GTGUI.LAYOUT_EVENT.GAME_SELECTED:

                // Create the VEND message to send
                var game = observableEvent.details;

                if (game.gameType === GTGUI.GAME_TYPE.ONLINE) {
				
					console.log("GAME OBJECT: ");
					console.log(game);

                    object.message.arg.push({name : "action", type : "string", content : "VEND_ONLINE"});

                    if (game.hasOwnProperty("binNumber") === true) {

                        object.message.arg.push({name : "binNumber", type : "int", content : game.binNumber});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("gameId") === true) {

                        object.message.arg.push({name : "gameId", type : "string", content : game.gameId});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("type") === true) {

                        object.message.arg.push({name : "type", type : "string", content : game.type});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("numberOfBoards") === true) {

                        object.message.arg.push({name : "numberOfBoards", type : "int", content : game.numberOfBoards});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("numberOfDraws") === true) {

                        object.message.arg.push({name : "numberOfDraws", type : "int", content : game.numberOfDraws});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("qpFlags") === true) {
						console.log("QP FLAGS");
						console.log(game.qpFlags);
						console.log(game.numberOfBoards);
                        object.message.arg.push({name : "qpFlags", type : "string", content : game.qpFlags.splice(0, game.numberOfBoards)});
						console.log(game.qpFlags);
                    }
                    else {
                    }

                    if (game.hasOwnProperty("boardData") === true) {

                        object.message.arg.push({name : "boardData", type : "string", content : game.strippedBoardData});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("auxillaryBoardData") === true) {

                        object.message.arg.push({name : "auxillaryBoardData", type : "string", content : game.auxillaryBoardData});
                        //object.message.arg.push({name : "auxillaryBoardData", type : "string", content : ""});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("auxillaryFlags") === true) {

                        object.message.arg.push({name : "auxillaryFlags", type : "string", content : game.auxillaryFlags.splice(0, game.numberOfBoards)});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("powerPlay") === true) {
                        if (game.gameId === "Powerball1" || game.gameId === "Powerball2") {
                            //if(game.powerPlay == true){
                            if(game.powerPlay){
                                object.message.arg.push({name : "powerPlay", type : "boolean", content : "true"});
                            } else {
                                object.message.arg.push({name : "powerPlay", type : "boolean", content : "false"});
                            }
                        }
                        
                    }
                    else {
                    }

                    if (game.hasOwnProperty("powerplay") === true) {

                        object.message.arg.push({name : "powerplay", type : "boolean", content : game.powerPlay});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("betType") === true) {

                        object.message.arg.push({name : "betType", type : "string", content : game.betType});
                        //object.message.arg.push({name : "betType", type : "string", content : ""});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("betAmount") === true) {

                        object.message.arg.push({name : "betAmount", type : "string", content : game.betAmount});
                        //object.message.arg.push({name : "betAmount", type : "string", content : ""});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("numberOfSpots") === true) {

                        object.message.arg.push({name : "numberOfSpots", type : "int", content : game.numberOfSpots});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("draw") === true) {

                        object.message.arg.push({name : "draw", type : "string", content : game.draw});
                    }
                    else {
                    }

                    if (game.hasOwnProperty("addOn") === true) {
                        if (game.gameId != "Powerball1" && game.gameId != "Powerball2") {
                            if(game.addOn){
                                object.message.arg.push({name : "addOn", type : "boolean", content : "true"});
                            } else {
                                object.message.arg.push({name : "addOn", type : "boolean", content : "false"});
                            }
                        }
                    }
                    else {
                    }
                }
                else if (game.gameType === GTGUI.GAME_TYPE.INSTANT) {

                    object.message.arg.push({name : "action", type : "string", content : "VEND_INSTANT_TICKET"});
                    object.message.arg.push({name : "gameId", type : "int", content : game.gameId});
                    object.message.arg.push({name : "binNumber", type : "int", content : game.binNumber});
                    object.message.arg.push({name : "locationSet", type : "int", content : 0});
                    object.message.arg.push({name : "locationX", type : "int", content : 0});
                    object.message.arg.push({name : "locationY", type : "int", content : 0});
                    object.message.arg.push({name : "quantity", type : "int", content : game.numberOfTickets});
                }
                break;

            case GTGUI.LAYOUT_EVENT.START_ATTRACT_SHOW:

                object.message.arg.push({name : "action", type : "string", content : "PLAY_ATTRACTSHOW"});
                object.message.arg.push({name : "show", type : "string", content : observableEvent.details.show});
               
                break;

            case GTGUI.LAYOUT_EVENT.STOP_ATTRACT_SHOW:

                object.message.arg.push({name : "action", type : "string", content : "STOP_ATTRACTSHOW"});
                object.message.arg.push({name : "show", type : "string", content : observableEvent.details.show});
                
                break;

            case GTGUI.LAYOUT_EVENT.AGE_VERIFICATION_TIMEOUT:

                object.message.arg.push({name : "action", type : "string", content : "AGE_VERIFICATION"});
                object.message.arg.push({name : "isTimedOut", type : "boolean", content : true});
                break;

            case GTGUI.LAYOUT_EVENT.LANGUAGE_EVENT:

                object.message.arg.push({name : "event", type : "string", content : "LANGUAGE_EVENT"});
                object.message.arg.push({name : "value", type : "string", content : observableEvent.details.language});
                break;

            case GTGUI.LAYOUT_EVENT.REINVEST_CONFIRMATION:

                var details = observableEvent.details;

                if( details.hasOwnProperty("ticketNumber")) {

                    object.message.arg.push({name : "action", type : "string", content : "INSTANT_VALIDATION"});
                    object.message.arg.push({name : "ticketNumber", type : "string", content : details.ticketNumber});
                }
                else {

                    object.message.arg.push({name : "action", type : "string", content : "ONLINE_VALIDATION"});
                    object.message.arg.push({name : "serialNumber", type : "string", content : details.serialNumber});
                }
                break;

            case GTGUI.LAYOUT_EVENT.WAGER_CONFIRMATION:

                argObj = observableEvent.details.status;
                object.message.arg.push({name : "action", type : "string", content : "INITIATE_VENDING"});
                object.message.arg.push({name : "gameId", type : "string", content : argObj.gameId});
                object.message.arg.push({name : "productID", type : "int", content : argObj.productID});
                object.message.arg.push({name : "binNumber", type : "int", content : argObj.binNumber});
                object.message.arg.push({name : "gameName", type : "string", content : argObj.gameName});
                object.message.arg.push({name : "price", type : "money", content : argObj.price});
                object.message.arg.push({name : "numberOfBoards", type : "int", content : argObj.numberOfBoards});
                object.message.arg.push({name : "numberOfDraws", type : "int", content : argObj.numberOfDraws});
                
                if(argObj.powerPlay != undefined){
                    object.message.arg.push({name : "powerPlay", type : "boolean", content : argObj.powerPlay});
                } else {
                    object.message.arg.push({name : "powerPlay", type : "boolean", content : false});
                }
                
                if(argObj.isCashPaymen != undefined){
                    object.message.arg.push({name : "isCashPayment", type : "boolean", content : argObj.isCashPayment});
                } else {
                    object.message.arg.push({name : "isCashPayment", type : "boolean", content : false});
                }
                object.message.arg.push({name : "digitalBetslipData", type : "jsonobject", content : argObj.digitalBetslipData});
                object.message.arg.push({name : "boardData", type : "string", content : argObj.boardData});
                break;

            case GTGUI.LAYOUT_EVENT.REQUEST_MANUAL_QP_ONLINE:

                argObj = observableEvent.details.details.data;
                object.message.arg.push({name : "action", type : "string", content : "REQUEST_MANUAL_QP_ONLINE"});
                object.message.arg.push({name : "gameId", type : "string", content : argObj.gameId});
                object.message.arg.push({name : "boardId", type : "int", content : argObj.boardId});
                object.message.arg.push({name : "boardData", type : "string", content : argObj.boardData});
                object.message.arg.push({name : "auxillaryBoardData", type : "string", content : argObj.auxillaryBoardData});
                object.message.arg.push({name : "betType", type : "string", content : argObj.betType});
                object.message.arg.push({name : "betAmount", type : "string", content : argObj.betAmount});

                if (argObj.hasOwnProperty("numberOfSpots") === true && argObj.numberOfSpots !== undefined) {

                    object.message.arg.push({name : "numberOfSpots", type : "int", content : argObj.numberOfSpots});
                }

                break;

            case GTGUI.LAYOUT_EVENT.PLAY_SOUND:

                var name = observableEvent.details.name;

                object.message.arg.push({name : "action", type : "string", content : "SOUND"});

                if (name === "CLICK" || name === "BEEP") {

                    object.message.arg.push({name : "type", type : "string", content : name});
                }
                else {

                    object.message.arg.push({name : "type", type : "string", content : "by_name"});
                    object.message.arg.push({name : "name", type : "string", content : name});
                }
                break;

            case GTGUI.LAYOUT_EVENT.ISSUE_REFUND:

                object.message.arg.push({name : "action", type : "string", content : "REFUND"});
                break;

            // CASHLESS: Print cashless receipt
            case GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT:

                var printCashlessCommand = observableEvent.details.printCashlessCommand
                
                object.message.arg.push({name : "action", type : "string", content : "PRINT_CASHLESS_RECEIPT"});
                object.message.arg.push({name : "isPrintNeeded", type : "boolean", content : printCashlessCommand});

                break;    

            // CASHLESS: Enable cashless device on cashless prompt button click
            case GTGUI.LAYOUT_EVENT.ENABLE_CASHLESS:

                object.message.arg.push({name : "action", type : "string", content: "ENABLE_CASHLESS_DEVICES"});
                break;

            // CASHLESS: Initate cashless transaction once OKAY button pressed on keypad modal
            // and sessionAmount is !== 0    
            case GTGUI.LAYOUT_EVENT.INITIATE_CASHLESS_TRANSACTION:

                var selectedCashlessAmount = observableEvent.details.selectedCashlessAmount

                object.message.arg.push({name : "action", type : "string", content: "INITIATE_CASHLESS_TRANSACTION"});
                object.message.arg.push({name : "selectedAmount", type : "money", content: selectedCashlessAmount});
                break; 

            // CASHLESS: End cashless session   
            case GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION:
                
                object.message.arg.push({name : "action", type : "string", content: "END_CASHLESS_SESSION"});
                break;
            
            default:
                console.log("layoutEvent: unknown event: " + observableEvent.action);
                return;
        }

        if (_websocketComm !== null) {
			console.log("Websocket Send:");
			console.log(object);
            _websocketComm.send(object);
        }
    };

    /*
     *
     * @param {type} response
     * @returns {undefined}
     */
    function postResponse(response) {

        var responseObj = {

            message: response,
            deviceInfo: deviceInfo
        };

        if (arguments[1] !== undefined) {

            var prop;

            for (prop in arguments[1]) {

                responseObj[prop] = arguments[1][prop];
            }
        }

        setTimeout(function() {

            _guiLayout.responseHandler(responseObj);
        }, 100, responseObj);
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function postEvent(event) {

        var eventObj = {

            message: event,
            deviceInfo: deviceInfo
        };

        if (arguments[1] !== undefined) {

            var prop;

            for (prop in arguments[1]) {

                eventObj[prop] = arguments[1][prop];
            }
        }

        setTimeout(function() {

            _guiLayout.eventHandler(eventObj);
        }, 100, eventObj);
    };

    /*
     *
     * @param {type} status
     * @returns {GTGUI.Main.setBinStatus.statuses|Boolean}
     */
    function setBinStatus(status) {

        var index;
        var values;
        var statusArray;

        var statuses = {

            noError : false,
            jammedTicket : false,
            jammedCutter : false,
            badEncoderOutput : false,
            noResponse : false,
            noTicket : false,
            exitSensorBlocked : false,
            cutterNotAtHome : false,
            inventoryNotAvailable : false,
            inventoryLow : false,
            disabled : false,
            binNotConfigured : false,
            binOffline : false
        };

        if (status[0] !== "[") {

            values = status;
        }
        else {

            values = status.substr(1, status.length - 2);
        }

        // Clear out any white spaces and split
        statusArray = values.replace(/ /g, '').split(",");

        for (index = 0; index < statusArray.length; index++) {

            statuses[statusArray[index]] = true;
        }

        return statuses;
    };
};

GTGUI.Main.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.Main.prototype.constructor = GTGUI.Main;

//------------------------------------------------------------------------------
/*
 *
 */
GTGUI.Main.COMM_EVENT = {

    COMM_EVENT: "COMM_EVENT",
    CONNECTED: "COMM_CONNECTED",
    DISCONNECTED: "COMM_DISCONNECTED",
    ERROR: "COMM_ERROR",
    MESSAGE: "COMM_MESSAGE"
};

/*
 *
 * @returns {GTGUI.Main.Comm}
 */
GTGUI.Main.Comm = function() {

    GTGUI.Observable.call(this);

    var _self = this;
    var webSocket = null;
    var connected = false;
    var _webSocketAddress = "";

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (webSocket !== null && connected) {

            webSocket.close();
            webSocket = null;
        }

        _self = null;
    };

    /*
     *
     * @param {type} websocketAddress
     * @returns {Boolean}
     */
    this.create = function(websocketAddress) {

        _webSocketAddress = websocketAddress;

        if (websocketAddress !== undefined && websocketAddress !== "") {

            webSocket = new WebSocket("ws://" + websocketAddress, "json");

            if (webSocket !== null) {

                // Bind the handlers
                webSocket.onopen = onOpenEvent;
                webSocket.onclose = onCloseEvent;
                webSocket.onmessage = onMessageEvent;
            }
            else {

                console.log("Could not create WebSocket...");
            }
        }
        else {

            console.log("WebSocket address is not set...");
        }

        return (webSocket !== null);
    };

    /*
     *
     * @returns {undefined}
     */
    function retryTimeoutHandler() {

        if (_self.create(_webSocketAddress) === false) {

            setTimeout(retryTimeoutHandler, 3000);
        }
    };

    /*
     *
     * @returns {undefined}
     */
    function onOpenEvent() {

        connected = true;
        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.Main.COMM_EVENT.COMM_EVENT, GTGUI.Main.COMM_EVENT.CONNECTED, null));
    };

    /*
     *
     * @param {type} closeEvent
     * @returns {undefined}
     */
    function onCloseEvent(closeEvent) {

        connected = false;
        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.Main.COMM_EVENT.COMM_EVENT, GTGUI.Main.COMM_EVENT.DISCONNECTED, null));

        setTimeout(retryTimeoutHandler, 3000);
    };

    /*
     *
     * @param {type} messageEvent
     * @returns {undefined}
     */
    function onMessageEvent(messageEvent) {

        if (typeof messageEvent.data === "string") {

            var messageObject = JSON.parse(messageEvent.data);

            if (messageObject !== null) {

                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.Main.COMM_EVENT.COMM_EVENT, GTGUI.Main.COMM_EVENT.MESSAGE, messageObject));
            }
            else {

                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.Main.COMM_EVENT.COMM_EVENT, GTGUI.Main.COMM_EVENT.ERROR, null));
            }
        }
        else {

            _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.Main.COMM_EVENT.COMM_EVENT, GTGUI.Main.COMM_EVENT.ERROR, null));
        }
    };

    /*
     *
     * @param {type} message
     * @returns {Boolean}
     */
    function websocketSend(message) {

        var jsonData;

        if (connected && webSocket !== null) {

            jsonData = JSON.stringify(message);
            console.log("websocketSend() -- called: " + jsonData);

            webSocket.send(jsonData);
            return true;
        }

        return false;
    };

    this.isConnected = function() {

        return connected;
    };

    this.send = function(message) {

        return websocketSend(message);
    };
};

GTGUI.Main.Comm.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.Main.Comm.prototype.constructor = GTGUI.Main.Comm;