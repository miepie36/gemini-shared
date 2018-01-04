/*
 *
 * This item is the property of IGT Global Solutions Corporation, Providence,
 * Rhode Island, and contains confidential and trade secret information.
 * It may not be transferred from the custody or control of IGT except
 * as authorized in writing by an officer of IGT.  Neither this item
 * nor the information it contains may be used, transferred, reproduced,
 * published, or disclosed, in whole or in part, and directly or
 * indirectly, except as expressly authorized by an officer of IGT,
 * pursuant to written agreement.
 *
 * Copyright © 2014, 2015 IGT Global Solutions Corporation.  All rights reserved.
 *
 */

// -----------------------------------------------------------------------------
// Get/create the top level namespace
var GTGUI = GTGUI || {};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
GTGUI.OneToOne = function() {

    GTGUI.Observable.call(this);

    var _self = this;

    var guiDiv = null;
    var gameZone = null;
    var promptZone = null;
    var helpZone = null;
    var presenter = null;
    var modal = null;
    var gameObjects = [];
    var idleTimerID = 0;
    var ageVerificationIdleTimerID = 0;
    var verificationTimerID = 0;
    var deviceInfo = null;
    var deviceState = {

        currentLanguage : GTGUI.OneToOne.DEFAULT_LANGUAGE,
        flipping : false,
        flipped : false,
        vending : false,
        vendError : false,
        vendErrorMessage : false,
        creditMaxed : false,
        cashlessPrivilege: false,
        help : false,
        idle : false,
        modalShowing : false,
        gameObjectPresented : null,
        ageVerified : false,
        ageVerification : false,
        ageVerificationNotBypassed : true,
        ageVerificationTrigger : false,
        tempWarning : false,
        maxCost : false,
        binUpdateCount : 0,
        activeSamplers : false,
        noOnlineGames : true,
        reinvest: false,
        cashless : {
            sessionStart: false,
            sessionEnabled: false,
            sessionAmount: 0,
            eventAuthorizeInit: false,
            eventSessionError: false,
            sessionTerminated: false,
            authorizeSuccess: false,
            // CASHLESS_UPDATE: acutalSale probably not needed
            actualSales: 0,
            authorizeError: false,
            eventSessionComplete: false,
            endOfDay: false,
            endOfDayWarning : false,
            offline: false
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        var game;
        var index;

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        if (ageVerificationIdleTimerID !== 0) {

            clearTimeout(ageVerificationIdleTimerID);
        }

        if (verificationTimerID !== 0) {

            clearTimeout(verificationTimerID);
        }

        if (modal) {

            modal.remove();
        }

        if (presenter) {

            presenter.remove();
        }

        // Remove/destory all current games
        for (index = gameObjects.length; index--;) {

            game = gameObjects[index];
            game.remove();
        }

        // Empty the list
        gameObjects.length = 0;
        gameObjects = null;

        if (helpZone) {

            helpZone.remove();
            helpZone = null;
        }

        if (promptZone) {

            promptZone.remove();
            promptZone = null;
        }

        if (gameZone) {

            gameZone.remove();
            gameZone = null;
        }

        deviceInfo = null;

        if (guiDiv) {

            guiDiv.remove();
            guiDiv = null;
        }

        _self = null;
    };

    /*
     *
     * @returns {Boolean}
     */

    this.create = function() {

        // Stop document events that cause highlight/drags
        document.body.ondblclick = stopPropagation;
        document.body.onmousedown = stopPropagation;

        // Set the guiDiv
        guiDiv = document.getElementsByClassName("guiDiv")[0];

        if (guiDiv === null) {

            console.log("<div id='guiDiv'> not defined");
            return false;
        }
        // Set the language
        guiDiv.setAttribute("lang", deviceState.currentLanguage);
        GTGUI.Language.setLanguage(deviceState.currentLanguage);
        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.LANGUAGE_EVENT, { language: deviceState.currentLanguage}));

        // Create the game zone
        gameZone = new GTGUI.OneToOne.GameZone();
        guiDiv.appendChild(gameZone.create());

        // Create the prompt/credit zone
        promptZone = new GTGUI.OneToOne.PromptZone();
        guiDiv.appendChild(promptZone.create());

        // catchall click event listener
        guiDiv.onclick = onGUIClick;

        updateState();

        return true;
    };

    /*
     *
     * @param {type} event
     * @returns {Boolean}
     */
    function stopPropagation(event) {

        event.stopPropagation();
        return false;
    }

    /*
     *
     * @param {type} deviceInfoNew
     * @returns {undefined}
     */
    this.createGames = function(deviceInfoNew) {

        var index, gameIndex, game;

        // Close everything, hide only no timer reset
        hideModal(true);
        hidePresenter(true);

        // Remove/destroy all current game objects
        for (index = gameObjects.length; index--;) {

            game = gameObjects[index];
            game.remove();
        }

        // Empty the list
        gameObjects.length = 0;

        // Don't create objects if nothing is passed in
        if (deviceInfoNew === undefined || deviceInfoNew === null) {

            deviceInfo = null;
            return;
        }

        // Save reference to the information
        deviceInfo = deviceInfoNew;

        // Create the game objects for online games
        for (index = 0, gameIndex = 0; index < deviceInfo.onlineGames.length; index++, gameIndex++) {

            game = new GTGUI.OneToOne.Game();
            gameZone.append(game.create(deviceInfo, deviceState, deviceInfo.onlineGames[index], gameIndex));

            gameObjects.push(game);
        }

        // Create the game objects for instant games
        for (index = 0; index < deviceInfo.binGames.length; index++, gameIndex++) {

            game = new GTGUI.OneToOne.Game();
            gameZone.append(game.create(deviceInfo, deviceState, deviceInfo.binGames[index], gameIndex));

            gameObjects.push(game);
        }

        setupLayout();
        updateState();
        resetIdleTimer(true);
    };

    /*
     *
     * @returns {undefined}
     */
    function setupLayout() {

        var index, gameObjectIndex = 0, elements, element, game;

        var layoutInfo = {row : 0, column : 0, offset : false, maxWidth : gameZone.mainElement().offsetWidth};

        hidePresenter(true);
        hideModal(true);

        // Set the device state
        deviceState.flipping = false;
        deviceState.flipped = false;
        deviceState.maxCost = 0;
        deviceState.vendError = false;
        //deviceState.reinvest = false;
        //online games enabled - status being recorded at that time
        if (deviceState.cashless.endOfDayWarning === true) {
            deviceState.cashless.endOfDay = true;
        }
        else { 
            deviceState.cashless.endOfDay = false;
        }
        
        console.log("END OF DAY: " + deviceState.cashless.endOfDay);

        for (index = 0; index < deviceInfo.samplers.length; index++) {

            if (deviceInfo.samplers[index].hasOwnProperty("parameters") === false) {

                break;
            }
        }

        // Show the sampler button if there are samplers
        if (index !== 0 && index === deviceInfo.samplers.length) {

            deviceState.activeSamplers = true;
        }
        else {

            deviceState.activeSamplers = false;
        }

        for (index = 0; index < gameObjects.length; index++, gameObjectIndex++) {

            game = gameObjects[index].game();

            if (game.gameId === "Sampler" && !deviceState.activeSamplers) {

                // Remove the sampler button
                element = gameObjects[index].element().parentNode;
                game.currentInventory = 0;

                if (element) {

                    element.removeChild(gameObjects[index].element());
                }
                continue;
            }


            addToLayout(gameObjects[index], layoutInfo, index);
        }

        // Mark all elements attributes to defaults.
        elements = guiDiv.getElementsByTagName("*");
        for (index = 0; index < elements.length; index++) {

            element = elements[index];
            element.setAttribute("data-flipped", "false");
            element.setAttribute("data-activesamplers", deviceState.activeSamplers);
            element.setAttribute("data-reinvestment", deviceState.reinvest);
        }
    }

    /*
     *
     * @param {type} game
     * @param {type} layoutInfo
     * @returns {undefined}
     */
    function addToLayout(game, layoutInfo, gameIndex) {

        var size, max, index, element, elements;

        element = game.element();
        element.setAttribute('data-activesamplers', deviceState.activeSamplers);
        elements = element.getElementsByTagName("*");

        for (index = 0; index < elements.length; index++) {

            element = elements[index];
            element.setAttribute('data-activesamplers', deviceState.activeSamplers);
        }

        gameZone.append(game.element());

        game.quickSell(false);
        game.show(true);

        max = game.maxCost();
        deviceState.maxCost = ((max > deviceState.maxCost) ? max : deviceState.maxCost);

        if (game.game().gameType !== GTGUI.GAME_TYPE.ONLINE) {


            /*if (layoutInfo.row === 0) {

                layoutInfo.row = gameZone.mainElement().offsetHeight - promptZone.mainElement().offsetHeight -
                    (game.getPosition().height * (deviceInfo.configuration.number_of_instant_bins / 4));
                }*/

            game.position(layoutInfo.row, layoutInfo.column);

            size = game.getPosition().width;
            layoutInfo.column += size;

            // Why + 10... because 1080 divided by an odd number of games results in some play and
            // button will never be 10px.
            if ((layoutInfo.column + 10) >= layoutInfo.maxWidth) {

                layoutInfo.column = gameZone.mainElement().offsetLeft;
                    layoutInfo.row += game.getPosition().height;

                if (!layoutInfo.offset && layoutInfo.row >= promptZone.mainElement().offsetTop - 2) {

                    layoutInfo.row += promptZone.mainElement().offsetHeight;
                    layoutInfo.offset = true;
                }
            }
        }
    };

    /*
     *
     */
    function flipAnimation() {

        var index, element, elements, game;
        var row = 0, column = 0, width, size;
        var promptOffset = false;

        updateState();

        width = gameZone.mainElement().offsetWidth;

        if (deviceState.flipped === false) {

            for (index = 0; index < gameObjects.length; index++) {

                game = gameObjects[index];

                if (game.game().gameType !== GTGUI.GAME_TYPE.ONLINE) {

                    if (row === 0) {

                        //row = gameZone.mainElement().offsetHeight - promptZone.mainElement().offsetHeight -
                        //      (game.getPosition().height * (deviceInfo.configuration.number_of_instant_bins / 4));
                    }

                    game.position(row, column);

                    size = game.getPosition().width;
                    column += size;

                    if (column + 10 >= width) {

                        column = gameZone.mainElement().offsetLeft;
                        row += game.getPosition().height;

                        if (!promptOffset && row >= promptZone.mainElement().offsetTop - 2) {

                            row += promptZone.mainElement().offsetHeight;
                            promptOffset = true;
                        }
                    }
                }
            }
        }
        else {

            column = gameZone.mainElement().offsetLeft;
            row = 0;

            for (index = 0; index < gameObjects.length; index++) {

                game = gameObjects[index];

                if (game.game().gameType !== GTGUI.GAME_TYPE.ONLINE) {

                    if (row === 0) {

                        //row = gameZone.mainElement().offsetHeight - game.getPosition().height;
                        row = gameZone.mainElement().offsetHeight;
                    }

                    game.position(row - game.element().offsetHeight, column);

                    size = game.getPosition().width;
                    column += size;

                    if (column + 10 >= width) {

                        column = gameZone.mainElement().offsetLeft;
                        row -= game.getPosition().height;

                        if (!promptOffset && row <= (promptZone.mainElement().offsetTop + promptZone.mainElement().offsetHeight + 2)) {

                            row -= promptZone.mainElement().offsetHeight;
                            promptOffset = true;
                        }
                    }
                }
            }
        }

        elements = guiDiv.getElementsByTagName("*");
        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-flipped", deviceState.flipped);
        }

        // Last game gets a transition handler
        game.element().addEventListener("webkitTransitionEnd", flipTransitionEndHandler(game.element(), "true"));
    };

    /*
     *
     * @param {type} gameElement
     * @param {type} flipped
     * @returns {GTGUI.OneToOne.flipTransitionEndHandler.handler}
     */
    var flipTransitionEndHandler = function(gameElement, flipped) {

        var handler = function(event) {

            gameElement.removeEventListener("webkitTransitionEnd", handler);

            deviceState.flipping = false;

            updateState();
        };

        return handler;
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onGUIClick(event) {

        // Process all button events
        if (event.target.nodeName === "BUTTON") {

            // Dispatch the sound event for each button click unless requested not too.
            if (event.target.hasOwnProperty("noclick") === false || event.target.noclick === false) {

                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "CLICK"}));
            }

            // Any button press will clear the vendErrorMessage only, but not the vend error state.
            deviceState.vendErrorMessage = false;

            switch(event.target.value) {

                case "GAME":

                    if (deviceState.flipping === false && deviceState.gameObjectPresented === null) {

                        if (event.target.getAttribute("data-state") === "playable") {

                            showPresenter(gameObjects[event.target.name], false);
                        }
                        else {

                            resetIdleTimer(true);
                            updateState();
                        }
                    }
                    break;

                case "PRESENTER_SELECTION_QUICK_SELL":
                case "PRESENTER_SELECTION":

                    if (deviceState.ageVerification && deviceState.ageVerified === false) {

                        deviceState.vending = false;
                        presenter.vendReset();

                        hidePresenter();
                    }
                    else if (event.target.gameData.totalCost > deviceInfo.credits) {

                        deviceState.tempWarning = true;
                        
                        if (deviceState.cashless.sessionStart === true) {

                            showModal("MESSAGE_INSUFFICIENT_FUNDS_CASHLESS", GTGUI.OneToOne.MODAL_OKAY, function() {

                                hideModal();

                                presenter.vendReset();
                                deviceState.vending = false;
                                deviceState.tempWarning = false;
                            });


                        }
                        else {
                            showModal("MESSAGE_INSUFFICIENT_FUNDS", GTGUI.OneToOne.MODAL_OKAY, function() {

                                hideModal();

                                presenter.vendReset();
                                deviceState.vending = false;
                                deviceState.tempWarning = false;
                            });
                        }
                    }
                    else if (event.target.gameData.confirmation === true) {

                        showModal("MESSAGE_CONFIRM_BETSLIP", GTGUI.OneToOne.MODAL_BETSLIP_CONFIRM, function(value, target) {

                            hideModal();

                            if (value === "YES") {

                                doPurchase(event.target);
                            }
                            else {

                                presenter.vendReset();
                                deviceState.vending = false;
                            }

                        }, event.target.gameData);
                    }
                    else {

                        doPurchase(event.target);
                    }
                    break;

                case "PRESENTER_CLOSE":

                    hidePresenter();
                    break;

                case "FLIP":

                    resetIdleTimer(true);

                    if (modal !== null && deviceState.vending !== true) {

                        modal.flip();
                    }

                    if (presenter !== null && deviceState.vending !== true) {

                        presenter.flip();
                    }
                    else if (deviceState.flipping === false && deviceState.vending !== true) {

                        deviceState.flipping = true;
                        deviceState.flipped = (deviceState.flipped ? false : true);

                        // Dispatch the sound event for screen flip
                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "Flipping.wav"}));

                        flipAnimation();
                    }
                    break;

                // CASHLESS: See GTGUI.DEVICE_RESPONSE.ENABLE_CASHLESS_DEVICES_RESPONSE
                case "CASHLESS":

                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ENABLE_CASHLESS, null));
                    break;        

                // CASHLESS: Click event for Other button
                case "OTHER":

                    if (deviceState.vending === false) {

                        showModal("MESSAGE_NUMBERPAD", GTGUI.OneToOne.MODAL_NUMBERPAD, function (value, returnValue) {
                                
                        var maxCredit = parseFloat(deviceInfo.configuration.max_credit.substr(3));
                        console.log(maxCredit);
                        var maxCreditMessage = document.querySelector(".keypadCreditMaxed");

                            if (value === "OKAY") {
                                
                                deviceState.cashless.sessionAmount = parseFloat(returnValue);

                                if (deviceState.cashless.sessionAmount > maxCredit) {
                                    
                                    deviceState.cashless.sessionStart = true; 
                                    deviceState.cashless.sessionAmount = 0;
                                    maxCreditMessage.style.display = "block";
                                    console.log("Amount exceeds $" + maxCredit + " max credit.");

                                }
                                else {
                                    deviceState.cashless.sessionAmount = parseFloat(returnValue);
                                    
                                    if (deviceState.cashless.sessionAmount > 0) {
                                        
                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.INITIATE_CASHLESS_TRANSACTION, {selectedCashlessAmount: "USD" + deviceState.cashless.sessionAmount + ".00"}))                                        
                                        deviceState.cashless.sessionStart = true;
                                        console.log("Cashless session amount $" + returnValue + ". Cashless session started.");
                                    
                                    }
                                    else {
                                        
                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));                                            
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false;
                                        console.log("Cashless session not started. Amount is zero.");
                                    } 

                                    hideModal();
                                }

                                

                            } 
                            else {

                                showModal("MESSAGE_QUICKPAD", GTGUI.OneToOne.MODAL_QUICKPAD, function (value, returnValue) {
                                    
                                    if (value === "OKAY") {
                                        deviceState.cashless.sessionAmount = parseFloat(returnValue);
                                        
                                        if (deviceState.cashless.sessionAmount > 0) {

                                            deviceState.cashless.sessionStart = true;
                                            console.log("Cashless session amount $" + returnValue + ". Cashless session started.");

                                        }
                                        else {
                                            deviceState.cashless.sessionEnabled = false;
                                            deviceState.cashless.sessionStart = false;
                                            _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));                                            
                                            console.log("Cashless session not started. Amount is zero.");

                                        } 

                                    } 
                                    else {

                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false; 
                                        deviceState.cashless.sessionAmount = 0;
                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                        console.log("Cashless session canceled.")

                                    }
                            
                                    hideModal();

                                });
                                 
                            }
                        });
                    
                    
                    }    
                   
                    updateState();   
                    break;

                case "HELP":

                    // There is no help for PYON
                    if (presenter !== null && presenter.hasOwnProperty("isPYON") && presenter.isPYON() === true) {

                        return;
                    }

                    if (deviceState.vending === false) {

                        var elements, index;

                        resetIdleTimer(false);

                        deviceState.help = true;

                        elements = guiDiv.getElementsByTagName("*");
                        for (index = 0; index < elements.length; index++) {

                            elements[index].setAttribute("data-help", "enabled");
                        }

                        //updateState();

                        if (presenter !== null) {

                            presenter.resetIdle(false);
                        }
                        else if (modal !== null) {

                            modal.resetIdle(false);
                        }

                        helpZone = new GTGUI.OneToOne.HelpZone();

                        guiDiv.appendChild(helpZone.create(deviceInfo, deviceState, function() {

                            var elements, index;

                            helpZone.remove();
                            helpZone = null;

                            deviceState.help = false;

                            elements = guiDiv.getElementsByTagName("*");
                            for (index = 0; index < elements.length; index++) {

                                elements[index].setAttribute("data-help", "disabled");
                            }

                            updateState();

                            if (presenter !== null) {

                                presenter.resetIdle(true);
                            }
                            else if (modal !== null) {

                                modal.resetIdle(true);
                            }
                            else {

                                resetIdleTimer(true);
                            }
                        }));
                    }
                    break;

                case "LANGUAGE":

                    // Toggle the language to use
                    deviceState.currentLanguage = (deviceState.currentLanguage === "en" ? "fr" : "en");

                    // Set the language
                    guiDiv.setAttribute("lang", deviceState.currentLanguage);
                    GTGUI.Language.setLanguage(deviceState.currentLanguage);
                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.LANGUAGE_EVENT, { language: deviceState.currentLanguage}));
                    updateState();

                    resetIdleTimer(true);
                    break;

                default:
                    // Any gui touch resets the idle timer
                    resetIdleTimer(true);
                    updateState();
                    break;
            }
        }
        else {

            if (deviceState.vending === false) {

                if (modal !== null) {

                    if (modal.keepState() === true) {

                        hideModal();
                        return;
                    }
                    else {

                        if (modal.close() === false) {

                            hideModal();
                            return;
                        }

                    }

                }
                else if (presenter !== null) {

                    if (presenter.hasOwnProperty("isPYON") === false || presenter.isPYON() === false) {

                        hidePresenter();
                        return;
                    }
                    else {

                        // If PYON is active check to see if it should be
                        // canceled.
                        presenter.pyoCancelCheck();
                    }
                }
            }

            // Any gui touch resets the idle timer
            resetIdleTimer(true);

            updateState();
        }
    }

    /*
     *
     * @param {type} target
     * @returns {undefined}
     */
    function doPurchase(target) {

        resetIdleTimer();

        deviceState.vending = true;
        updateState();

        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.GAME_SELECTED, target.gameData));
    }

    /*
     *
     * @param {type} gameObject
     * @param {type} playslip
     * @returns {undefined}
     */
    function showPresenter(gameObject, playslip) {

        var index, elements;
        // CASHLESS If cashless session active, resetIdle timer is true
        if(deviceState.cashless.sessionStart === true) {
            resetIdleTimer(true);
        }
        else {
            resetIdleTimer(false);
        }
        

        if (presenter !== null) {

            presenter.removeListener(GTGUI.PRESENTER_EVENT.PRESENTER_EVENT, presenterEvent);
            presenter.remove();
            presenter = null;

            // Adjust the device state
            deviceState.gameObjectPresented = null;
            deviceState.vending = false;
        }

        deviceState.gameObjectPresented = gameObject;

        elements = guiDiv.getElementsByTagName("*");
        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-presenter", "enabled");
        }

        if (playslip === true) {

            presenter = new GTGUI.OneToOne.PlayslipPresenter();
            presenter.create(deviceState.gameObjectPresented, deviceInfo, deviceState, guiDiv, function() {

                hidePresenter();
                return;
            });
        }
        else if (gameObject.game().gameId === "Sampler") {

            presenter = new GTGUI.OneToOne.SamplerPresenter();
            presenter.create(deviceState.gameObjectPresented, deviceInfo, deviceState, guiDiv, function() {

                hidePresenter();
                return;
            });
        }
        else {

            presenter = new GTGUI.OneToOne.Presenter();

            presenter.addListener(GTGUI.PRESENTER_EVENT.PRESENTER_EVENT, presenterEvent);
            presenter.create(deviceState.gameObjectPresented, deviceInfo, deviceState, guiDiv, function(value) {

                if (value === "TIMED_OUT" && deviceState.vending === true) {

                    showModal("MESSAGE_NO_RESPONSE_TIMEOUT", GTGUI.OneToOne.MODAL_OKAY);
                }

                hidePresenter();
                return;
            });
        }

        updateState();
    }

    /*
     *
     * @param {type} observableEvent
     * @returns {undefined}
     */
    function presenterEvent(observableEvent) {

        switch (observableEvent.action) {

            case GTGUI.PRESENTER_EVENT.REQUEST_MANUAL_QP_ONLINE:
                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.REQUEST_MANUAL_QP_ONLINE, observableEvent));
                break;

            case GTGUI.PRESENTER_EVENT.REQUEST_UPDATE:
                updateState();
                break;

            case GTGUI.PRESENTER_EVENT.REQUEST_CLICK:
                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "CLICK"}));
                break;
        }
    };

    /*
     *
     * @param {type} onlyHide
     * @returns {undefined}
     */
    function hidePresenter(onlyHide) {

        var index, elements;

        if (presenter !== null) {

            presenter.removeListener(GTGUI.PRESENTER_EVENT.PRESENTER_EVENT, presenterEvent);
            presenter.remove();
            presenter = null;

            // Adjust the device state
            deviceState.gameObjectPresented = null;
            deviceState.vending = false;

            elements = guiDiv.getElementsByTagName("*");
            for (index = 0; index < elements.length; index++) {

                elements[index].setAttribute("data-presenter", "disabled");
            }

            updateState();
        }

        if (onlyHide === undefined || onlyHide === false) {

            resetIdleTimer(true);
        }
    }

    /*
     *
     * @param {type} message
     * @param {type} type
     * @param {type} callback
     * @param {type} data
     * @returns {undefined}
     */
    function showModal(message, type, callback, data, timeout) {

        var position, index, elements;

        resetIdleTimer(false);

        if (modal !== null) {

            modal.remove();
            modal = null;
        }

        deviceState.modalShowing = true;

        elements = guiDiv.getElementsByTagName("*");
        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-presenter", "enabled");
        }

        position = (presenter !== null ? presenter.getPosition() : undefined);

        modal = new GTGUI.OneToOne.Modal();
        guiDiv.appendChild(modal.create(deviceInfo, deviceState, position, message, type, function (value, returnValue) {

            if (callback !== undefined) {

                callback(value, returnValue);
            }
            else {

                hideModal();
            }

            return;

        }, data, timeout));

        updateState();
    }

    /*
     *
     * @param {type} onlyHide
     * @returns {undefined}
     */

    function hideModal(onlyHide) {

        var index, elements;

        if (modal !== null) {

            modal.remove();
            modal = null;

            deviceState.modalShowing = false;
            deviceState.vendError = false;

            // Do not reset these if the presenter is active
            if (presenter === null) {

                elements = guiDiv.getElementsByTagName("*");
                for (index = 0; index < elements.length; index++) {

                    elements[index].setAttribute("data-presenter", "disabled");
                }
            }

            updateState();
        }

        if (onlyHide === undefined || onlyHide === false) {

            resetIdleTimer(true);
        }
    }
    /*
     *
     */
    function updateState() {

        var index;

        if (deviceInfo) {

            // Update device state
            deviceStateUpdate();

            //Update gameZone
            gameZone.update(deviceInfo, deviceState);

            //Update prompt
            promptZone.update(deviceInfo, deviceState);

            // Update the modal
            if (modal !== null) {

                modal.update(deviceInfo, deviceState);
            }

            // Update the presenter
            if (presenter !== null) {

                presenter.update(deviceInfo, deviceState);
            }

            for (index = gameObjects.length; index--;) {

                gameObjects[index].update(deviceInfo, deviceState);
            }
        }
    };

    /*
     *
     */
    function deviceStateUpdate() {

        var toState = 0, printerState;
        var elements, index;
        var deviceStates = ["enabled", "warning", "error", "disabled", "cashlessWarning", "cashlessYellow", "errorEnabled"];

        function setState(newState) {

            if (newState > toState) {

                toState = newState;
            }
        };

        
    if (deviceInfo === null || (deviceInfo.deviceStatus.indexOf("enabled") === -1)) {
        if (deviceInfo.credits > 0) {
            setState(2);
        } else {
            setState(3);
        }

        if (deviceState.cashless.eventSessionComplete) {

             _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: false }));
            
            deviceInfo.credits = 0;
            deviceState.cashless.eventSessionComplete = false;
            deviceState.cashless.authorizeSuccess = false;
            deviceState.cashless.eventAuthorizeInit = false;
            deviceState.cashless.eventSessionError = false;
            deviceState.cashless.actualSales = 0;
            deviceState.cashless.sessionAmount = 0;
            deviceState.cashless.sessionEnabled = false;
            deviceState.cashless.sessionStart = false;
        }

        if (presenter !== null) {

                presenter.remove();
                presenter = null;

                // Adjust the device state
                deviceState.gameObjectPresented = null;
                deviceState.vending = false;

                elements = guiDiv.getElementsByTagName("*");
                for (index = 0; index < elements.length; index++) {

                    elements[index].setAttribute("data-presenter", "disabled");
                }
        }

        if (modal !== null && deviceInfo.deviceStatus !== "disabledNoInventory") {

                deviceState.modalShowing = false;
                modal.remove();
                modal = null;

                elements = guiDiv.getElementsByTagName("*");
                for (index = 0; index < elements.length; index++) {

                    elements[index].setAttribute("data-presenter", "disabled");
                }
        }

        // Turn of attract screen if initalizing.
        if (deviceInfo.deviceStatus === "disabledInitializing") {

                resetIdleTimer(false);
        }

        // Any device states should clear age verification
            deviceState.ageVerified = false;

        }
        else {

            // Need to show warning layout...
            if (deviceState.tempWarning === true) {

                setState(5);

            }


            if(deviceState.cashless.sessionTerminated === true) {

                setState(3)
            }

            // Need to show warning layout...
            if (deviceState.vendError === true) {


                setState(2);
            }

            // CASHLESS: If session error, set state to error
            if (deviceState.cashless.eventSessionError === true) {


                setState(4);
            }


            if (deviceState.billAcceptorOkay === false || (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable") || deviceInfo.coinDoor === "removed") {

                if (deviceState.cashlessPrivilege) {

                    setState(5);

                }
                else {
                    if(deviceState.billAcceptorOkay === false && deviceInfo.credits === 0 && (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed")){
                        setState(3);
                    }
                    else {
                        setState(6);
                    }
                }

            }
            else {
                setState(0);
            }

            // Check printer status
            switch (deviceInfo.printerStatus) {

                case "noError":
                    printerState = "okay";
                    setState(0);
                    break;

                case "paperLow":
                    printerState = "paperlow";
                        if (deviceState.cashlessPrivilege) {

                            setState(5);
                        }
                        else {

                            setState(1);
                        }
                    break;

                case "noPaper":
                    printerState = "paperout";
                        if (deviceState.cashlessPrivilege) {

                            setState(4);
                        }
                        else {

                            setState(3);
                        }

                    break;

                default:

                    printerState = "error";
                    setState(3);
                    break;
            }

            // Display a warning
            if (deviceInfo.temperatureStatus === "warning") {

                if (deviceState.billAcceptorOkay === false || deviceState.coinAcceptorOkay === false || deviceState.cashless.eventSessionError === true || deviceInfo.printerStatus !== "noError") {

                    if (deviceState.cashlessPrivilege) {

                        setState(4);
                    }
                    else {
                        setState(3);
                    }

                }
                else {

                    setState(5);
                }

            }

        }


        // Set all elements to proper states
        elements = guiDiv.getElementsByTagName("*");

        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-devicestate", deviceStates[toState]);
            elements[index].setAttribute("data-printer", printerState);
        }

        // Set the device state disabled flag
        deviceState.disabled = (toState === 3);
    };

    /*
     *
     * @param {type} eventObj
     * @returns {undefined}
     */
    this.eventHandler = function(eventObj) {

        // Save updated device info
        deviceInfo = eventObj.deviceInfo;

        switch (eventObj.message) {

            case GTGUI.DEVICE_EVENT.CREDIT_EVENT: {

                var elements2;
                
                if (deviceState.vending === true) {

                    if (deviceInfo.credits === 0) {

                        deviceState.reinvest = false;

                        elements2 = guiDiv.getElementsByTagName("*");
                        for (index = 0; index < elements2.length; index++) {

                            elements2[index].setAttribute("data-reinvestment", deviceState.reinvest);

                        }

                    }
                    else {

                        deviceState.reinvest = true;

                        elements2 = guiDiv.getElementsByTagName("*");
                        for (index = 0; index < elements2.length; index++) {

                            elements2[index].setAttribute("data-reinvestment", deviceState.reinvest);

                        }
                    }
                }
                 

                // If credits gets to zero, reset age verified
                if (deviceInfo.credits === 0 && deviceState.ageVerificationTrigger === false) {
                
                    // Reset some flags...  
                    
                    deviceState.ageVerified = false;
                    deviceState.vendError = false;

                    //deviceState.cashless.endOfDay = false;

                    // Default back to french
                    guiDiv.setAttribute("lang", "fr");
                    GTGUI.Language.setLanguage("fr");
                    deviceState.currentLanguage = "fr";
                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.LANGUAGE_EVENT, { language: deviceState.currentLanguage}));                    
                }                

                deviceState.creditMaxed = eventObj.status.isMaxCredit;
                deviceState.ageVerificationTrigger = false;
                deviceState.vendErrorMessage = false;

                // Bill rejected, over max credit
                if (eventObj.status.event === "BILL_REJECTED_OVER_MAX_CREDIT") {

                    currentArg = GTGUI.Language.getCurrency(deviceInfo.configuration.max_credit);
                    message = GTGUI.Language.get("MESSAGE_MAX_CREDITS", currentArg);

                    if (deviceState.modalShowing === true) {

                        modal.close();
                    }

                    showModal(message, GTGUI.OneToOne.MODAL_OKAY);
                }  
                // Check if a refund was issued
                else if (eventObj.status.event === "REFUND") {

                    showModal("MESSAGE_REFUND_PRINTING" , GTGUI.OneToOne.MODAL_OKAY, function() {

                        hideModal();
                    });
                }

                updateState();
                break;
            }

            case GTGUI.DEVICE_EVENT.STATUS_MANAGER_EVENT: {

                updateState();
                break;
            }

            case GTGUI.DEVICE_EVENT.DEVICE_STATUS_EVENT: {

                // Check billacceptor status
                switch (deviceInfo.billAcceptorStatus) {

                    case "billAccepting":
                    case "billStacked":
                    case "billStacking":
                    case "billReturning":
                    case "billRejected":
                    case "billHolding":
                    case "billAcceptorDisabled":
                    case "noError":
                    case "notAvailable":
                    case "escrow":
                    case "vendValid":
                        deviceState.billAcceptorOkay = true;
                        break;

                    default:
                        deviceState.billAcceptorOkay = false;
                        break;
                }

                // Check coinAcceptor status
                switch (deviceInfo.coinAcceptorStatus) {

                    case "busy":
                    case "noError":
                    case "notAvailable":
                    case "fullWarning":
                    case "coinAcceptorDisabled":
                    case "disabled":
                        deviceState.coinAcceptorOkay = true;
                        break;

                    default:
                        deviceState.coinAcceptorOkay = false;
                        break;
                }

                updateState();
                break;
            }

            case GTGUI.DEVICE_EVENT.DAY_END_EVENT: {
                
                var event = eventObj.status.event;

                switch (event) {


                    case "DAY_END_ALERT":
                        
                        if (deviceState.cashlessPrivilege === true) {

                            if (deviceState.cashless.sessionStart === true) {

                                showModal("MESSAGE_END_DAY_WARNING", GTGUI.OneToOne.MODAL_OKAY, function () {
                                    
                                    deviceState.cashless.endOfDayWarning = true;
                                    deviceState.cashless.endOfDay = true;
                                    console.log("END OF DAY: " + deviceState.cashless.endOfDay);
                                    hideModal();
                                });

                            }
                            else {
                                
                                deviceState.cashless.endOfDay = true;
                                deviceState.cashless.endOfDayWarning = true;
                                console.log("END OF DAY: " + deviceState.cashless.endOfDay);

                            }
                        
                        }


                        updateState();

                    console.log("DAY_END_ALERT");
                    break;

                    case "DAY_END":

                        if (deviceState.reinvest === true) {

                            deviceState.reinvest = false;

                            elements2 = guiDiv.getElementsByTagName("*");
                                for (index = 0; index < elements2.length; index++) {

                                elements2[index].setAttribute("data-reinvestment", deviceState.reinvest);

                            }
                        }
                        
                        if (deviceState.cashless.authorizeSuccess === true) {
                            
                            showModal("MESSAGE_END_DAY_COMPLETE", GTGUI.OneToOne.MODAL_OKAY, function () {
                                
                                //_self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: true }));
                                deviceState.cashless.endOfDayWarning = false;
                                deviceState.cashless.endOfDay = true;
                                deviceState.cashless.authorizeSuccess = false;
                                deviceState.cashless.eventAuthorizeInit = false;
                                deviceState.cashless.sessionAmount = 0;
                                deviceState.cashless.sessionStart = 0;
                                hideModal();

                            });
                        }
                        else {
                            deviceState.cashless.endOfDayWarning = false;
                            deviceState.cashless.endOfDay = true;
                        }

                        console.log("END OF DAY: " + deviceState.cashless.endOfDay);
                        updateState();
                     
                    break;

                }
                
                break;

            }    
            
            // CASHLESS: Cashless eventHandler 
            case GTGUI.DEVICE_EVENT.CASHLESS_EVENT: {
                var message = "";
                var state = eventObj.status.value;

                switch (eventObj.status.value) {

                    case "AUTHORIZE_INIT":

                    
                        deviceState.cashless.eventAuthorizeInit = true;
                        //authorizedAmount = deviceState.cashless.sessionAmount;
                        console.log("AUTHORIZE_INIT is " + deviceState.cashless.eventAuthorizeInit);
                        

                        break;

                    case "AUTHORIZE_SUCCESS":
                        
                        
                        deviceState.cashless.eventAuthorizeInit = false;
                        deviceState.cashless.authorizeSuccess = true;
                        
                          
                        console.log ("AUTHORIZE_SUCCESS is " + deviceState.cashless.authorizeSuccess);

                        break;

                    case "AUTHORIZE_ERROR":

                        
                        deviceState.ageVerified = false;
                        deviceState.cashless.sessionEnabled = false;
                        deviceState.cashless.sessionStart = false;
                        deviceState.cashless.sessionAmount = 0;
                        deviceState.cashless.actualSales = 0;
                        deviceState.cashless.eventAuthorizeInit = false;
                        deviceState.cashless.authorizeSuccess = false;

                        console.log("AUTHORIZE_ERROR is enabled");

                        break;

                    // CASHLESS: SESSION_COMPLETE Various scenarios
                    case "SESSION_COMPLETE":

                    
                        deviceState.ageVerified = false;
                        deviceState.cashless.eventSessionComplete = true;
                    
                        // If PRINTER_UNAVAILABLE, show modal with OKAY button
                            if (deviceInfo.printerStatus !== "noError") {

                                showModal("MESSAGE_CASHLESS_PRINT_RECEIPT", GTGUI.OneToOne.MODAL_OKAY, function (value, returnValue) {
                                    
                                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: false }));

                                    deviceInfo.credits = 0;
                                    deviceState.cashless.eventSessionComplete = false;
                                    deviceState.cashless.authorizeSuccess = false;
                                    deviceState.cashless.eventAuthorizeInit = false;
                                    deviceState.cashless.eventSessionError = false;
                                    deviceState.cashless.actualSales = 0;
                                    deviceState.cashless.sessionAmount = 0;
                                    deviceState.cashless.sessionEnabled = false;
                                    deviceState.cashless.sessionStart = false;
                                    hideModal();
                                    
                                 });

                            }
                            else if (deviceInfo.billAcceptorStatus !== "noError") {


                                showModal("MESSAGE_CASHLESS_PRINT_RECEIPT", GTGUI.OneToOne.MODAL_PRINT_CASHLESS_RECEIPT, function (value, returnValue) {
                                    
                                    if (value === "RECEIPT") {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: true }));
                                        
                                      
                                        deviceInfo.credits = 0;
                                        deviceState.cashless.eventSessionComplete = false;
                                        deviceState.cashless.authorizeSuccess = false;
                                        deviceState.cashless.eventAuthorizeInit = false;
                                        deviceState.cashless.eventSessionError = false;
                                        deviceState.cashless.actualSales = 0;
                                        deviceState.cashless.sessionAmount = 0;
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false;

                                        console.log("Print receipt");
                                    }
                                    else {
                                       
                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: false }));

                                        deviceInfo.credits = 0;
                                        deviceState.cashless.eventSessionComplete = false;
                                        deviceState.cashless.authorizeSuccess = false;
                                        deviceState.cashless.eventAuthorizeInit = false;
                                        deviceState.cashless.eventSessionError = false;
                                        deviceState.cashless.actualSales = 0;
                                        deviceState.cashless.sessionAmount = 0;
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false;

                                        console.log("No receipt");
                                    }
                                    hideModal();
                                });

                            }
                            else {

                                showModal("MESSAGE_CASHLESS_PRINT_RECEIPT", GTGUI.OneToOne.MODAL_PRINT_CASHLESS_RECEIPT, function (value, returnValue) {
                                    
                                    if (value === "RECEIPT") {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: true }));
                                        
                                        deviceInfo.credits = 0;
                                        deviceState.cashless.eventSessionComplete = false;
                                        deviceState.cashless.authorizeSuccess = false;
                                        deviceState.cashless.eventAuthorizeInit = false;
                                        deviceState.cashless.eventSessionError = false;
                                        deviceState.cashless.actualSales = 0;
                                        deviceState.cashless.sessionAmount = 0;
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false;

                                        console.log("END OF DAY: " + deviceState.cashless.endOfDay);
                                        console.log("Print receipt");
                                    }
                                    else {
                                       
                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: false }));

                                        deviceInfo.credits = 0;
                                        deviceState.cashless.eventSessionComplete = false;
                                        deviceState.cashless.authorizeSuccess = false;
                                        deviceState.cashless.eventAuthorizeInit = false;
                                        deviceState.cashless.eventSessionError = false;
                                        deviceState.cashless.actualSales = 0;
                                        deviceState.cashless.sessionAmount = 0;
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.sessionStart = false;

                                        console.log("END OF DAY: " + deviceState.cashless.endOfDay);
                                        console.log("No receipt");
                                    }
                                    hideModal();
                                });
                            } 

                    updateState();
                    break;

                    case "SESSION_TERMINATE":

                        showModal("MESSAGE_CASHLESS_COMM_LOSS", GTGUI.OneToOne.MODAL_OKAY, function (value, returnValue) {
                            
                            deviceInfo.credits = 0;
                            deviceState.cashless.eventSessionComplete = false;
                            deviceState.cashless.authorizeSuccess = false;
                            deviceState.cashless.eventAuthorizeInit = false;
                            deviceState.cashless.eventSessionError = false;
                            deviceState.cashless.actualSales = 0;
                            deviceState.cashless.sessionAmount = 0;
                            deviceState.cashless.sessionEnabled = false;
                            deviceState.cashless.sessionStart = false;
                            hideModal();
                        
                        });   
                    
                    updateState();
                    break;

                    case "DEVICE_ONLINE":

                        deviceState.cashless.eventSessionError = false;
                        //deviceState.cashless.endOfDay = false;
                        deviceState.cashless.sessionAmount = 0;
                        deviceState.cashless.sessionEnabled = false;
                        deviceState.cashless.sessionStart = false;

                    break;

                    case "DEVICE_OFFLINE":

                        deviceState.cashless.eventSessionError = true;
                        deviceState.cashless.sessionAmount = 0;
                        deviceState.cashless.sessionEnabled = false;
                        deviceState.cashless.sessionStart = false;

                        showModal("MESSAGE_CASHLESS_UNAVAILABLE", GTGUI.OneToOne.MODAL_OKAY);
           

                    break;

                    case "SIGNON_PRIVILEGE":

                        deviceState.cashlessPrivilege = eventObj.status.cashlessPrivilege;
                        console.log("Cashless Privilege: "+deviceState.cashlessPrivilege);
                    break;
            
                }

            }     
            case GTGUI.DEVICE_EVENT.VEND_EVENT: {

                var message = "";
                var state = eventObj.status.value;
                var promo = eventObj.status.freeTicket;

                switch (state) {

                    case "VENDING":

                        // Clear previous errors...

                        
                        deviceState.vendError = false;
                        deviceState.vendErrorMessage = false;

                        if (presenter !== null) {

                            // If presented game is INSTANT delay vend animations to
                            // account for physical vend speed.
                            if (deviceState.gameObjectPresented !== null && deviceState.gameObjectPresented.game().gameType === GTGUI.GAME_TYPE.INSTANT)
                            {
                                setTimeout(function() {

                                    presenter.vend();

                                }, GTGUI.OneToOne.INSTANT_VEND_DELAY);
                            }
                            else {

                                presenter.vend();
                            }
                        }
                        break;

                    case "VENDED":


                    
                        if (promo !== undefined && promo !== "none") {

                            showPromotionMessage(promo);
                        }
                        break;

                    case "IDLE":

                        if (presenter !== null) {

                            presenter.vendComplete();
                        }
                        break;

                    case "INSUFFICIENT_FUNDS_ERROR":
                        if (deviceState.cashless.sessionStart === true) {

                            message = "MESSAGE_INSUFFICIENT_FUNDS_CASHLESS";

                        }
                        else {

                            message = "MESSAGE_INSUFFICIENT_FUNDS";
                        }
                        
                        break;

                    case "UNAVAILABLE_VENDING_DEVICE_SELECTED_ERROR":
                    case "INSUFFICIENT_INVENTORY_ERROR":
                        message = "MESSAGE_VENDING_ERROR";
                        break;

                    case "VEND_MULTI_ERROR":
                        message = "MESSAGE_VENDING_ERROR_MULTI_TICKET";
                        break;

                    case "VENDING_ERROR":

                        message = "MESSAGE_VENDING_ERROR_DISPENSING";

                        if (eventObj.status.hasOwnProperty("reason")) {

                            if (eventObj.status.reason.indexOf("[11]" !== -1)) {

                                message = "MESSAGE_ERROR_DRAW_BREAK";
                            }
                            else if (eventObj.status.reason.indexOf("[2]" !== -1)) {

                                message ="MESSAGE_ERROR_DRAW_IN_PROGRESS";
                            }
                        }

                        break;

                    case "TRANSACTION_TIMEOUT_ERROR":
                            message = "MESSAGE_VENDING_ERROR_TIMEOUT";
                            break;
                }

                if (message !== "") {

                    showModal(message , GTGUI.OneToOne.MODAL_OKAY);

                    if (presenter !== null) {

                        presenter.vendReset();
                    }

                    deviceState.vending = false;
                    deviceState.vendError = true;
                    deviceState.vendErrorMessage = true;
                }

                updateState();

                break;
            }

            case GTGUI.DEVICE_EVENT.ONLINE_GAME_EVENT: {

                switch (eventObj.status.event) {

                    case "DIGITAL_PLAYSLIP":

                        // check to see if price <= credits available
                        var message = "";
                        var price = parseFloat(eventObj.status.price.substr(3));

                        if (price <= deviceInfo.credits)
                            message = "MESSAGE_CONFIRM_BETSLIP";
                        else {
                            if (deviceState.cashless.sessionStart === true) {
                                message = "MESSAGE_INSUFFICIENT_FUNDS_CASHLESS";
                            }
                            else {
                                message = "MESSAGE_INSUFFICIENT_FUNDS";
                            }
                            showModal(message, GTGUI.OneToOne.MODAL_OKAY);
                            break;
                        }

                        showModal(message, GTGUI.OneToOne.MODAL_BETSLIP_CONFIRM, function (value) {

                            if (value === "YES") {

                                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.WAGER_CONFIRMATION, eventObj));
                            }

                            hideModal();

                        }, eventObj.status);

                        break;

                    case "BETSLIP_FAILURE":

                        var message = "MESSAGE_BETSLIP_ERROR";

                        if (presenter !== null) {

                            presenter.vendReset();
                            deviceState.vending = false;
                        }

                        switch (eventObj.status.value) {

                            case "invalidBetslip":
                                message = "MESSAGE_BETSLIP_ERROR";
                                break;

                            case "invalidBoardData":
                                message = "MESSAGE_INVALID_BOARD_DATA";
                                break;

                            case "scriptError":
                                message = "MESSAGE_SCRIPT_ERROR";
                                break;

                            case "errorPrintingBetslipWager":
                                message = "MESSAGE_ERROR_PRINTING_BETSLIP_WAGER";
                                break;

                            case "bothQPAndNumbers":
                                message = "MESSAGE_BOTH_QP_AND_NUMBERS";
                                break;

                            case "emptyBetslip":
                                message = "MESSAGE_EMPTY_BETSLIP";
                                break;
                                
                            case "tooManySecondarySelections":
                                message = "MESSAGE_EMPTY_BETSLIP";
                                break;
                                
                            case "bothQPAndNumber":
                                message = "MESSAGE_INVALID_QP"
                                break;

                            case "boardInSequence":
                                message = "MESSAGE_BOARD_IN_SEQUENCE";
                                break;

                            case "tooManyDraws":
                                message = "MESSAGE_TO_MANY_DRAWS";
                                break;

                            case "invalidBetAmount":
                                message = "MESSAGE_INVALID_BET_AMOUNT";
                                break;

                            case "noJoker":
                                message = "MESSAGE_NO_JOKER";
                                break;

                            case "invalidSpots":
                                message = "MESSAGE_INVALID_SPOTS";
                                break;

                            case "MultiBetAmountSelect":
                                message = "MESSAGE_MULTI_BET_AMOUNT_SELECT";
                                break;

                            case "MultiSpotsSelect":
                                message = "MESSAGE_MULTI_SPOTS_SELECT";
                                break;

                            case "invalidDraws":
                                message = "MESSAGE_INVALID_DRAWS";
                                break;

                            case "invalidJokerSelect":
                                message = "MESSAGE_INVALID_JOKER_SELECT";
                                break;

                            case "invalidbettype":
                                message = "MESSAGE_INVALID_BET_TYPE";
                                break;

                            case "tooManyBetTypes":
                                message = "MESSAGE_TO_MANY_BET_TYPES";
                                break;
                                
                            case "tooManySelections":
                                message = "MESSAGE_TOO_MANY_MARKS";
                                break;
                                
                            case "tooFewSelections":
                                message = "MESSAGE_TOO_FEW_MARKS";
                                break;

                            case "invalidAdvPlaySelection":
                                message = "MESSAGE_INVALID_ADV_PLAY_SELECTION";
                                break;

                            case "betslipSuppressed":
                                message = "MESSAGE_BETSLIP_SUPPRESSED";
                                break;

                            default:

                                if (eventObj.status.value.indexOf("TooMany") === 0) {

                                    message = "MESSAGE_TO_MANY_MARKS";
                                }
                                else if (eventObj.status.value.indexOf("TooFew") === 0) {

                                    message = "MESSAGE_TO_FEW_MARKS";
                                }
                                else if (eventObj.status.value.indexOf("MissingBoard") === 0) {

                                    message = "MESSAGE_MISSING_BOARD";
                                }
                                break;
                        }

                        showModal(message, GTGUI.OneToOne.MODAL_OKAY, function() {

                            hideModal();
                            hidePresenter();
                        });
                        break;

                    case "DATA_AVAILABLE":

                        deviceState.vending = true;
                        hideModal();
                        showPresenter(gameObjects[0], true);
                        break;

                    case "STATUS_CHANGED":

                        setupLayout();

                        // No online games available
                        deviceState.noOnlineGames = (eventObj.status.value === "[]" ? true : false);

                        updateState();

                        break;
                }

                break;
            }

            case GTGUI.DEVICE_EVENT.CONFIGURATION_EVENT: {

                var nodes, node, index;

                if (deviceInfo.configuration.age_verification) {

                    deviceState.ageVerification = deviceState.ageVerificationNotBypassed;

                    if (deviceInfo.enable_RF_remote === "ageverification"){
                        deviceState.ageVerification = deviceState.ageVerificationNotBypassed
                    }
                }
                else {

                    // Reset the age verification
                    deviceState.ageVerificationNotBypassed = true;
                    deviceState.ageVerification = false;
                    deviceState.ageVerified = false;
                }

                // Set the bin size on all created elements so far.
                guiDiv.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);

                nodes = guiDiv.getElementsByTagName("*");
                for (index = 0; index < nodes.length; index++) {

                    node = nodes[index];
                    node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
                }

                updateState();
                break;
            }

            case GTGUI.DEVICE_EVENT.AGE_EVENT: {

                if (deviceState.ageVerification === true) {

                    var verified = false;
                    var message = "";

                    if (eventObj.status.isValid === true) {

                        if (eventObj.status.isLicenseExpired === true) {

                            message = "MESSAGE_LICENSE_EXPIRED";
                        }
                        else if (eventObj.status.isAgeVerified === true) {

                            verified = true;

                            // When verified, some of the core device become enabled
                            // which trigger deviceInfo updates and a creditEvent but
                            // since a creditEvent with 0 credits will clear the
                            // ageVerified flag, this flag makes sure that doesn't happen.
                            deviceState.ageVerificationTrigger = true;
                        }
                        else {

                            message = "MESSAGE_LICENSE_NOT_AUTHORIZED";
                        }
                    }
                    else {

                        message = "MESSAGE_LICENSE_INVALID";
                    }

                    deviceState.ageVerified = verified;
                }
                else {

                    message = "MESSAGE_INVALID_BARCODE";
                }

                if (message !== "") {

                    showModal(message, GTGUI.OneToOne.MODAL_OKAY);
                }

                updateState();

                break;
            }

            case GTGUI.DEVICE_EVENT.REMOTE_MODULE_EVENT: {

                if (eventObj.status.value === "rfRemoteTriggered" && deviceInfo.configuration.age_verification) {

                    var ageVerifiedTimeout;
                    deviceState.ageVerified = true;

                    if (verificationTimerID !== 0) {

                        clearTimeout(verificationTimerID);
                        verificationTimerID = 0;
                    }

                    // Toggle and set
                    deviceState.ageVerificationNotBypassed = (deviceState.ageVerificationNotBypassed === true ? false : true);
                    deviceState.ageVerification = deviceState.ageVerificationNotBypassed;
                    updateState();

                    if (deviceState.ageVerificationNotBypassed === false) {
                        if (deviceInfo.credits > 0){
                            ageVerifiedTimeout = parseInt(GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITH_CREDITS);
                        } else {
                            ageVerifiedTimeout = parseInt(GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITHOUT_CREDITS);
                        }

                        if(ageVerifiedTimeout !== 0) {

                            verificationTimerID = setTimeout(function() {

                                // Toggle it back and set...
                                deviceState.ageVerificationNotBypassed = (deviceState.ageVerificationNotBypassed === true ? false : true);
                                deviceState.ageVerification = deviceState.ageVerificationNotBypassed;
                                updateState();

                            }, ageVerifiedTimeout);
                        }
                    }
                }
                break;
            }

            case GTGUI.DEVICE_EVENT.STOP_ATTRACTSHOW: {

                updateState();
                break;
            }

            default:
                break;
        }

        // Any event resets the idle time...
        resetIdleTimer(true);
    };

    /*
     *
     * @param {type} responseObj
     * @returns {undefined}
     */
    this.responseHandler = function(responseObj) {

        // Save updated device info
        deviceInfo = responseObj.deviceInfo;

        // Responses reset the idle timer
        resetIdleTimer(true);

        switch (responseObj.message) {

            case GTGUI.DEVICE_RESPONSE.LOGIN_RESPONSE:
                break;

            case GTGUI.DEVICE_RESPONSE.VEND_INSTANT_TICKET_RESPONSE:
                break;

            case GTGUI.DEVICE_RESPONSE.VEND_ONLINE_RESPONSE:

                if (responseObj.result === "FAILURE") {

                    // SYSTEM ERRORS
                    if (responseObj.reason.indexOf("[11]" !== -1)) {

                        showModal("MESSAGE_ERROR_DRAW_BREAK", GTGUI.OneToOne.MODAL_OKAY);
                    }
                    else if (responseObj.reason.indexOf("[2]" !== -1)) {

                        showModal("MESSAGE_ERROR_DRAW_IN_PROGRESS", GTGUI.OneToOne.MODAL_OKAY);
                    }

                    if (presenter !== null) {

                        presenter.vendReset();
                    }
                }
                break;

            


            case GTGUI.DEVICE_RESPONSE.ENABLE_CASHLESS_DEVICES_RESPONSE:

                if (responseObj.result === "SUCCESS") {

                    deviceState.cashless.sessionEnabled = true;

                    
                    if (deviceState.vending === false) {
                        
                        if (deviceInfo.printerStatus !== "noError") {

                            showModal("MESSAGE_CASHLESS_PRINTER_UNAVAILABLE", GTGUI.OneToOne.MODAL_YESNO, function (value, returnValue) {
                            
                                if (value === "YES") {

                                    showModal("MESSAGE_QUICKPAD", GTGUI.OneToOne.MODAL_QUICKPAD, function (value, returnValue) {
                                
                                if (value === "OKAY") {

                                    deviceState.cashless.sessionAmount = returnValue;

                                    if (deviceState.cashless.sessionAmount) {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.INITIATE_CASHLESS_TRANSACTION, {selectedCashlessAmount: deviceState.cashless.sessionAmount}))                                        
                                        deviceState.cashless.sessionStart = true;
                                        deviceState.cashless.sessionEnabled = false;
                                        console.log("Cashless session amount " + returnValue + ". Cashless session started.");

                                    }
                                    else {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                        deviceState.cashless.sessionEnabled = false;
                                        deviceState.cashless.eventAuthorizeInit = false;
                                        deviceState.cashless.sessionStart = false;
                                        console.log("Cashless session not started. Amount is zero.");


                                    }  
                                
                                }
                                else {

                                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                    deviceState.cashless.sessionStart = false;
                                    deviceState.cashless.sessionEnabled = false;
                                    deviceState.cashless.sessionAmount = 0;
                                    console.log("Cashless session canceled.")

                                }
                                hideModal();   
                            });      

                                }
                                else {

                                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                    deviceState.cashless.sessionStart = false;
                                    deviceState.cashless.sessionEnabled = false;
                                    deviceState.cashless.sessionAmount = 0;
                                    console.log("Cashless session canceled.")
                                    hideModal(); 

                                }

                            }); // end showModal printer unavailable   

                        

                        }
                        else {
                            showModal("MESSAGE_QUICKPAD", GTGUI.OneToOne.MODAL_QUICKPAD, function (value, returnValue) {
                                
                                if (value === "OKAY") {

                                    // CASHLESS parseFloat removed since cashless denomination value is not a number
                                    deviceState.cashless.sessionAmount = returnValue;

                                    if (deviceState.cashless.sessionAmount) {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.INITIATE_CASHLESS_TRANSACTION, {selectedCashlessAmount: deviceState.cashless.sessionAmount}))                                        
                                        deviceState.cashless.sessionStart = true;
                                        console.log("Cashless session amount " + returnValue + ". Cashless session started.");

                                    }
                                    else {

                                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                        deviceState.cashless.sessionStart = false;
                                        deviceState.cashless.sessionEnabled = false;
                                        console.log("Cashless session not started. Amount is zero.");


                                    }    
                                
                                }
                                else {

                                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                                    deviceState.cashless.sessionStart = false;
                                    deviceState.cashless.sessionEnabled = false;
                                    deviceState.cashless.sessionAmount = 0;
                                    console.log("Cashless session canceled.")

                                }
                                hideModal();   
                            });    

                        }// end deviceInfo.printerStatus   

                    }// end deviceState.vending
                    //updateState();  

                    console.log("Show keypad modal");
                }
                else {

                    if (responseObj.errorCode === "cashlessDevicesUnavailable") {

                        deviceState.cashless.eventSessionError = true;
                        updateState();   
                    }
                    

                    console.log(responseObj.errorCode);
                }

                break;

            case GTGUI.DEVICE_RESPONSE.INITIATE_CASHLESS_TRANSACTION_RESPONSE:
                
                if (responseObj.result === "SUCCESS") {
                    
                    deviceState.cashless.sessionEnabled = false;
                    deviceState.cashless.eventAuthorizeInit = true;
                 
                  
                }
                else {
                   
                   showModal("MESSAGE_CASHLESS_UNAVAILABLE", GTGUI.OneToOne.MODAL_OKAY, function (value, returnValue) {
                        
                        deviceState.cashless.eventAuthorizeInit = false;
                        deviceState.cashless.sessionEnabled = false;
                        deviceState.cashless.sessionStart = false;
                        deviceState.cashless.sessionAmount = 0;

                        hideModal();
                   
                   }); 


                    
                }

                updateState();    

                break;         

            case GTGUI.DEVICE_RESPONSE.VEND_ONLINE_BETSLIP_RESPONSE:

                if (responseObj.result === "FAILURE") {

                    // SYSTEM ERRORS
                    if (responseObj.reason.indexOf("[11]" !== -1)) {

                        showModal("MESSAGE_ERROR_DRAW_BREAK", GTGUI.OneToOne.MODAL_OKAY);
                    }
                    else if (responseObj.reason.indexOf("[2]" !== -1)) {

                        showModal("MESSAGE_ERROR_DRAW_IN_PROGRESS", GTGUI.OneToOne.MODAL_OKAY);
                    }

                    if (presenter !== null) {

                        presenter.vendReset();
                    }
                }
                break;

            case GTGUI.DEVICE_RESPONSE.REQUEST_MANUAL_QP_ONLINE_RESPONSE:

                if (presenter !== null) {

                    presenter.quickPickResponse(responseObj);
                }
                break;

            case GTGUI.DEVICE_RESPONSE.ONLINE_VALIDATION_RESPONSE:

                // cash credits have been applied and free or exchange tickets are printing
                if ((responseObj.hasOwnProperty("numberOfFreeTickets") && responseObj.numberOfFreeTickets > 0) || (responseObj.hasOwnProperty("hasExchangeTicket") && responseObj.hasExchangeTicket === true)) {

                    showModal("MESSAGE_REINVESTMENT_APPLIED_TICKET", GTGUI.OneToOne.MODAL_OKAY);

                }
                // only cash credits have been applied
                else {

                    showModal("MESSAGE_REINVESTMENT_APPLIED", GTGUI.OneToOne.MODAL_OKAY);


                }
                break;

            case GTGUI.DEVICE_RESPONSE.INSTANT_VALIDATION_RESPONSE:
                showModal("MESSAGE_REINVESTMENT_APPLIED", GTGUI.OneToOne.MODAL_OKAY);
                break;

            case GTGUI.DEVICE_RESPONSE.TICKET_INQUIRY_RESPONSE:
            case GTGUI.DEVICE_RESPONSE.INSTANT_INQUIRY_RESPONSE:

                // send no print receipt if session complete is true
                if (deviceState.cashless.eventSessionComplete === true) {

                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.ISSUE_CASHLESS_RECEIPT, {printCashlessCommand: false }));
                    deviceState.cashless.eventSessionComplete = false;
                    deviceState.cashless.authorizeSuccess = false;
                    deviceState.cashless.actualSales = 0;
                    deviceState.cashless.eventSessionError = false;
                    deviceState.cashless.eventAuthorizeInit = false;
                    deviceState.cashless.sessionEnabled = false;
                    deviceState.cashless.sessionStart = false;
                    deviceState.cashless.sessionAmount = 0;

                }

                var message = "MESSAGE_TICKET_SCAN_ERROR";
                var altMessage = "MESSAGE_REINVESTMENT_CONFIRM";
                var reinvestmentAllowed = true;
                var playAudio = false;
                var elements;

                if (responseObj.result === "SUCCESS")   {

                    // set an initial message based on inquiry result
                    switch (responseObj.inquiryResult)
                    {
                        case "seeRetailer":
                            message = "MESSAGE_TICKET_SEE_RETAILER";
                            break;
                        case "cash":
                            message = "MESSAGE_TICKET_WINNER";
                            playAudio = true;
                            break;
                        case "notAWinner":
                            message = "MESSAGE_TICKET_NOT_A_WINNER";
                            reinvestmentAllowed = false;
                            break;
                        case "claim":
                            message = "MESSAGE_TICKET_WINNER";
                            playAudio = true;
                            break;
                        case "freeTicket":
                            message = "MESSAGE_TICKET_WINNER";
                            playAudio = true;
                            break;
                        case "freeMerchandise":
                            message = "MESSAGE_TICKET_WINNER";
                            playAudio = true;
                            break;
                        case "alreadyPaid":
                            message = "MESSAGE_TICKET_ALREADY_PAID";
                            reinvestmentAllowed = false;
                            break;
                        case "alreadyClaimed":
                            message = "MESSAGE_TICKET_ALREADY_CLAIMED";
                            reinvestmentAllowed = false;
                            break;
                        case "resultsNotIn":
                            message = "MESSAGE_TICKET_RESULTS_NOT_IN";
                            reinvestmentAllowed = false;
                            break;
                        case "seeRetailer":
                            message = "MESSAGE_TICKET_SEE_RETAILER";
                            break;
                        case "drawsRemaining":
                            message = "MESSAGE_TICKET_NOT_A_WINNER_DRAWS_REMAIN";
                            reinvestmentAllowed = false;
                            break;
                        case "notAWinnerDrawsRemain":
                            message = "MESSAGE_TICKET_NOT_A_WINNER_DRAWS_REMAIN";
                            reinvestmentAllowed = false;
                            break;
                        case "ticketExpired":
                            message = "MESSAGE_TICKET_EXPIRED";
                            break;
                        case "alreadyCancelled":
                            message = "MESSAGE_TICKET_ALREADY_CANCELLED";
                            break;
                        case "notRedeemable":
                            message = "MESSAGE_TICKET_NOT_REDEEMABLE";
                            break;
                        case "rejectSecurity":
                            message = "MESSAGE_TICKET_WINNER_HIGH";
                            break;
                        default:
                            message = "MESSAGE_TICKET_SCAN_ERROR";
                            reinvestmentAllowed = false;
                            break;
                    }

                    // check to see if reinvestment is possible and the inquiry result allows reinvestment
                    if(reinvestmentAllowed === true && isReinvestmentPossible(responseObj) && deviceInfo.deviceStatus !== "disabledCreditDeviceOffline"){


                        // check if age verification mode is on and age has been verified
                        if ((deviceState.ageVerification && deviceState.ageVerified) || deviceState.ageVerification === false) {

                            // The header...
                            message = GTGUI.Language.get("MESSAGE_REINVESTMENT_CONFIRM_HEADER");

                            // The winnings
                            // this contains the winning amount
                            message += "<div class=\"cash-prompt\">" + (GTGUI.Language.get("CURRENCY_SYMBOL") + parseFloat(responseObj.amount.substr(3))) + GTGUI.Language.get("MESSAGE_REINVESTMENT_CASH") + "</div>";

                            // now see if there is a free ticket
                            if (responseObj.numberOfFreeTickets > 0) {

                                message += "<div class=\"cash-prompt\">" + responseObj.numberOfFreeTickets + GTGUI.Language.get("MESSAGE_REINVESTMENT_FREE_TICKET")  + "</div>";
                                altMessage = "MESSAGE_REINVESTMENT_CONFIRM_TICKETS";
                            }

                            // now check for hasExchangeTicket
                            if (responseObj.hasExchangeTicket === true) {

                                message += "<div class=\"cash-prompt\">" + GTGUI.Language.get("MESSAGE_REINVESTMENT_EXCHANGE_TICKET") + "</div>";
                                altMessage = "MESSAGE_REINVESTMENT_CONFIRM_TICKETS";
                            }

                            message += GTGUI.Language.get(altMessage);

                            // ask the user if they want to reinvest the winnings
                            showModal(message, GTGUI.OneToOne.MODAL_REINVEST, function(value) {

                                if (value === "YES") {

                                    // This will make data-reinvestment = true, hiding the cashless button if cashlessPrivilege is true

                                    if (deviceState.cashlessPrivilege) {

                                        deviceState.reinvest = true;

                                        elements = guiDiv.getElementsByTagName("*");
                                        for (index = 0; index < elements.length; index++) {

                                            elements[index].setAttribute("data-reinvestment", deviceState.reinvest);
                                        }
 
                                    }
                                  

                                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.REINVEST_CONFIRMATION, responseObj));
                                    hideModal();
                                }
                                else {

                                    deviceState.reinvest = false;

                                    elements = guiDiv.getElementsByTagName("*");
                                    for (index = 0; index < elements.length; index++) {

                                        elements[index].setAttribute("data-reinvestment", deviceState.reinvest);
                                    }

                                    showModal("MESSAGE_REINVESTMENT_NOT_APPLIED", GTGUI.OneToOne.MODAL_OKAY);
                                }
                            }, responseObj);

                            return;
                        }
                        else {

                            message = "MESSAGE_REINVESTMENT_VERIFY_AGE";
                        }
                    }
                }
                else {

                    switch (responseObj.errorCode)
                    {
                        case "invalidTicketNumber":
                            message = "MESSAGE_TICKET_SCAN_ERROR";
                            break;
                        case "inquiryUnavailable":
                            message = "MESSAGE_TICKET_SCAN_ERROR";
                            break;
                        case "invalidBarcode":
                            message = "MESSAGE_INVALID_BARCODE";
                            break;
                    }
                }

                // TODO play audio if a winner
                if (playAudio) {

                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "waho.ogg"}));
                }

                showModal(message, GTGUI.OneToOne.MODAL_OKAY);
                break;

            case GTGUI.DEVICE_RESPONSE.ONLINE_GAME_RESPONSE:

                setupLayout();
                updateState();
                break;

            case GTGUI.DEVICE_RESPONSE.REFUND_RESPONSE:

                if (responseObj.result === "FAILURE") {

                    showModal("MESSAGE_REFUND_ISSUE_FAILED", GTGUI.OneToOne.MODAL_OKAY, function(response) {

                        hideModal();
                    });
                }

                updateState();
                break;

            case GTGUI.DEVICE_RESPONSE.BIN_GAME_RESPONSE:

                deviceState.binUpdateCount++;

                // Update everything after the final bin, we always get all the bin information in a series.
                if (deviceState.binUpdateCount >= deviceInfo.configuration.number_of_instant_bins) {

                    deviceState.binUpdateCount = 0;

                    var gameObjectsIndex = deviceInfo.onlineGames.length;
                    var index;

                    for (index = 0; index < deviceInfo.configuration.number_of_instant_bins; index++, gameObjectsIndex++) {

                        gameObjects[gameObjectsIndex].remove();
                        gameObjects[gameObjectsIndex] = new GTGUI.OneToOne.Game();

                        gameZone.append(gameObjects[gameObjectsIndex].create(deviceInfo, deviceState, deviceInfo.binGames[index], gameObjectsIndex));
                    }

                    setupLayout();
                    updateState();
                }
                break;
        }
    };

    /*
     *
     * @param {type} responseObj
     * @returns {undefined}
     */
    function showPromotionMessage(promo) {

        var message;

        switch (promo) {

            case "freePromoPrize":
                message = "MESSAGE_PROMOTION_FREE_TICKET";
                break;
            case "cashPromoPrize":
                message = "MESSAGE_PROMOTION_CASH";
                break;
            case "couponPromoPrize":
                message = "MESSAGE_PROMOTION_COUPON";
                break;
            case "rafflePromoPrize":
                message = "MESSAGE_PROMOTION_RAFFLE";
                break;
            case "voucherPromoPrize":
                message = "MESSAGE_PROMOTION_VOUCHER";
                break;
            case "doublerPromoPrize":
                message = "MESSAGE_PROMOTION_DOUBLE";
                break;
            case "markupPromoPrize":
                message = "MESSAGE_PROMOTION_MARKUP";
                break;
        }

        if (message !== "") {

            showModal(message, GTGUI.OneToOne.MODAL_OKAY);

            // Play sound
            _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "winnerDefault.ogg"}));
        }
        else {

            // Could still be up if user didn't press okay
            hideModal();
        }
    }

    /*
     *
     * @param {type} responseObj
     * @returns {Boolean}
     */
    function isReinvestmentPossible(responseObj)
    {
        var amount, maximum, maxCredit;

        if (responseObj.hasOwnProperty("amount") &&
            responseObj.hasOwnProperty("maximumReinvestmentAmount") &&
            responseObj.hasOwnProperty("reinvestmentCountAllowed")) {

            amount = parseFloat(responseObj.amount.substr(3));
            maximum = parseFloat(responseObj.maximumReinvestmentAmount.substr(3));
            maxCredit = parseFloat(deviceInfo.configuration.max_credit.substr(3));

            if ((responseObj.reinvestmentCountAllowed > 0) && (amount > 0) &&
                (amount <= maximum) && ((amount + deviceInfo.credits) <= maxCredit) && deviceState.cashless.sessionStart === false) {

                return true;
            }
        }

        return false;
    }

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        // Only used if the attract screen wanted
        if (parseInt(GTGUI.OneToOne.IDLE_TIMEOUT) !== 0) {

            var elements, index;

            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (deviceState.idle === true) {

                deviceState.idle = false;

                elements = guiDiv.getElementsByTagName("*");

                for (index = 0; index < elements.length; index++) {

                    elements[index].setAttribute("data-deviceidle", "false");
                }

                // Play Age verification audio instructions if enabled
                if (deviceState.ageVerification === true && deviceState.ageVerified === false) {

                    //_self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.PLAY_SOUND, {name: "female_voice_13_best.ogg"}));
                }

                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.STOP_ATTRACT_SHOW, {show: GTGUI.OneToOne.ATTRACT_SHOW_NAME}));

            }

            // Only restart the timer if we aren't vending, aren't initializing, modal is null and presenter is null
            if (restart && deviceState.vending === false && deviceInfo.deviceStatus !== "disabledInitializing"
                && presenter === null && modal === null) {

                
                // CASHLESS: idelTimerID set for cashless session
                if (deviceState.cashless.sessionStart === true) {
                    
                    idleTimerID = setTimeout(cashlessIdleTimeoutHandler, GTGUI.OneToOne.IDLE_CASHLESS_MODAL);

                }
                else {
                    
                    if (deviceInfo.credits === 0) {

                        idleTimerID = setTimeout(onIdleTimeoutHandler, GTGUI.OneToOne.IDLE_TIMEOUT);

                    }

                }

                
            }
            else {
                // CASHLESS If presenter is active in cashless state, activate cashlessIdle
                if (presenter !== null && deviceState.cashless.sessionStart === true) {

                    idleTimerID = setTimeout(cashlessIdleTimeoutHandler, GTGUI.OneToOne.IDLE_CASHLESS_MODAL);
 
                }
            }


         
        }

        // Reset the age verifcation timeout if enabled
        if(ageVerificationIdleTimerID !== 0) {

            clearTimeout(ageVerificationIdleTimerID);
            ageVerificationIdleTimerID = 0;
        }

        // Reenable it if needed...
        if (deviceState.ageVerified === true) {

            if (parseInt(GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITHOUT_CREDITS) !== 0 && deviceInfo.credits === 0) {

                ageVerificationIdleTimerID = setTimeout(onAgeVerificationTimeoutHandler, GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITHOUT_CREDITS);
            }
            else if (parseInt(GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITH_CREDITS) !== 0 && deviceInfo.credits !== 0) {

                ageVerificationIdleTimerID = setTimeout(onAgeVerificationConfirmTimeoutHandler, GTGUI.OneToOne.IDLE_AGE_VERIFICATION_TIMEOUT_WITH_CREDITS);
            }
        }
    }

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onIdleTimeoutHandler(event) {

        var elements, index;

        idleTimerID = 0;
        deviceState.idle = true;

        setupLayout();

        // Default language to default -- commented out to allow for language-specific attract shows -- AMORSE 9/14/2017
        // deviceState.currentLanguage = GTGUI.OneToOne.DEFAULT_LANGUAGE;

        // Set the language
        //guiDiv.setAttribute("lang", deviceState.currentLanguage);
        //GTGUI.Language.setLanguage(deviceState.currentLanguage);
        //_self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.LANGUAGE_EVENT, { language: deviceState.currentLanguage}));

        elements = guiDiv.getElementsByTagName("*");

        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-deviceidle", "true");
        }

        updateState();

        // Dispatch the play attract show event
        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.START_ATTRACT_SHOW, {show: GTGUI.OneToOne.ATTRACT_SHOW_NAME}));

        // This will shutdown the attract screen and cause it to restart
        if (parseInt(GTGUI.OneToOne.ATTRACT_TIMEOUT) !== 0) {

            idleTimerID = setTimeout(function() {

                resetIdleTimer(true);

            }, GTGUI.OneToOne.ATTRACT_TIMEOUT);
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onIdleTimeoutHandlerCheck(event) {

        idleTimerID = 0;

        showModal("MESSAGE_IDLE_TIMEOUT_CONFIRMATION" , GTGUI.OneToOne.MODAL_OKAY, function(value) {

            if (value === "TIMEOUT") {

                onIdleTimeoutHandler(null);
            }

            hideModal();

        }, null, (GTGUI.OneToOne.IDLE_TIMEOUT / 2));
    };

    /**
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onAgeVerificationConfirmTimeoutHandler(event) {

        if (deviceState.ageVerified === true && deviceState.cashlessPrivilege === false) {

            showModal("MESSAGE_AGE_TIMEOUT_CONFIRMATION" , GTGUI.OneToOne.MODAL_OKAY, function(value) {

                if (value === "TIMEOUT") {

                    if (deviceState.ageVerified === true) {

                        deviceState.ageVerified = false;
                        ageVerificationIdleTimerID = 0;

                        _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.AGE_VERIFICATION_TIMEOUT, null));
                    }
                }

                hideModal();
            });
        }
    };

    // CASHLESS: Idle timeout event handler
    function cashlessIdleTimeoutHandler(event) {
        
        var elements2;

        if (deviceState.cashless.authorizeSuccess === true) {

            showModal("MESSAGE_CASHLESS_IDLE", GTGUI.OneToOne.MODAL_CASHLESS_IDLE, function (value, returnValue) {

                if (value === "OKAY") {
                    
                    hideModal();
                }
                else {
                   
                    _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.END_CASHLESS_SESSION, null));
                    
                     // Prevent deviceState.reinvest from happening if timeout occurs with credits
                     // in machine after vending - see CREDIT_EVENT
                    if (deviceState.reinvest === true) {

                        deviceState.reinvest = false;

                        elements2 = guiDiv.getElementsByTagName("*");
                        for (index = 0; index < elements2.length; index++) {

                            elements2[index].setAttribute("data-reinvestment", deviceState.reinvest);

                        }
                    }
                   
                    deviceState.ageVerified = false;
                    deviceInfo.credits = 0;
                    deviceState.cashless.eventSessionComplete = false;
                    deviceState.cashless.authorizeSuccess = false;
                    deviceState.cashless.actualSales = 0;
                    deviceState.cashless.eventSessionError = false;
                    deviceState.cashless.eventAuthorizeInit = false;
                    deviceState.cashless.sessionEnabled = false;
                    deviceState.cashless.sessionStart = false;
                    deviceState.cashless.sessionAmount = 0;

                    if (presenter !==null) {
                        hidePresenter();
                    }
                    hideModal();

                    console.log ("AUTHORIZE_SUCCESS is " + deviceState.cashless.authorizeSuccess);
                    console.log ("Credits equals " + deviceInfo.credits);
                    console.log ("AUTHORIZE_INIT is " + deviceState.cashless.eventAuthorizeInit);
                    console.log ("Cashless session is " +deviceState.cashless.sessionStart);
                    
                    
                }

            });


        }


    };




    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onAgeVerificationTimeoutHandler(event) {

        if (deviceState.ageVerified === true) {

            deviceState.ageVerified = false;
            ageVerificationIdleTimerID = 0;

            _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.LAYOUT_EVENT.LAYOUT_EVENT, GTGUI.LAYOUT_EVENT.AGE_VERIFICATION_TIMEOUT, null));

            updateState();
        };

        resetIdleTimer(true);
    };
};

GTGUI.OneToOne.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.OneToOne.prototype.constructor = GTGUI.OneToOne;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// HELP ZONE
//------------------------------------------------------------------------------
GTGUI.OneToOne.HelpZone = function() {

    var helpElement = null;
    var idleTimerID = 0;
    var closeCallback = null;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        closeCallback = null;

        helpElement.parentNode.removeChild(helpElement);
        helpElement = null;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} callback
     * @returns {GTGUI.OneToOne.HelpZone.helpElement|Element}
     */
    this.create = function(deviceInfo, deviceState, callback) {

        var helpFile = null;
        var gameTypePresented = -1;

        helpFile = "noMoneyInMachine_FromMainScreen.html";

        closeCallback = callback;

        if (deviceState.gameObjectPresented !== null) {

            gameTypePresented = deviceState.gameObjectPresented.game().gameType;
        }

        if (deviceInfo.deviceStatus === "enabled") {

            if (gameTypePresented === -1) {

                if (deviceInfo.credits === 0) {

                    if (deviceState.ageVerification) {

                        helpFile = (deviceState.ageVerified ? "ageVerified_noMoney_FromMainScreen.html" : "noAgeVerified_fromMainScreen.html");
                    }
                    else {

                        helpFile = "noMoneyInMachine_FromMainScreen.html";
                    }
                }
                else {

                    if (deviceInfo.credits >= deviceState.maxCost) {

                        helpFile = "moneyInMachine_enough_fromMainScreen.html";
                    }
                    else {

                        helpFile = "moneyInMachine_notEnough_fromMainScreen.html";
                    }
                }
            }
            else if (gameTypePresented === GTGUI.GAME_TYPE.ONLINE) {

                if (deviceInfo.credits === 0) {

                    if (deviceState.ageVerification) {

                        helpFile = (deviceState.ageVerified ? "ageVerified_noMoney_FromOnlineScreen.html" : "noAgeVerified_fromOnlineScreen.html");
                    }
                    else {

                        helpFile = "moneyInMachine_enough_fromOnlineScreen.html";
                    }
                }
                else {

                    if (deviceInfo.credits >= deviceState.gameObjectPresented.maxCost()) {

                        helpFile = "moneyInMachine_enough_fromOnlineScreen.html";
                    }
                    else {

                        helpFile = "moneyInMachine_notEnough_fromOnlineScreen.html";
                    }
                }
            }
            else if (gameTypePresented === GTGUI.GAME_TYPE.INSTANT) {

                if (deviceInfo.credits === 0) {

                    if (deviceState.ageVerification) {

                        helpFile = (deviceState.ageVerified ? "ageVerified_noMoney_FromInstantScreen.html" : "noAgeVerified_fromInstantScreen.html");
                    }
                    else {

                        helpFile = "noMoneyInMachine_FromInstantScreen.html";
                    }
                }
                else {

                    if (deviceInfo.credits >= deviceState.gameObjectPresented.maxCost()) {

                        helpFile = "ageVerified_FromInstantScreen.html";
                    }
                    else {

                        helpFile = "moneyInMachine_notEnough_fromInstantScreen.html";
                    }
                }
            }
        }

        helpElement = document.createElement("div");
        helpElement.className = "helpZone";

        if (helpFile.search(".html") === -1) {

            helpElement.style.backgroundImage = GTGUI.Language.getFileUrl(helpFile);
        }
        else {

            helpElement.innerHTML='<object class="helpZoneLoadedObject" type="text/html" data="' + GTGUI.Language.getFile(helpFile) + '" ></object>';
        }

        helpElement.onclick = function(event) {

            event.stopPropagation();
            closeCallback();

            return false;
        };

        resetIdleTimer(true);

        return helpElement;
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        if (parseInt(GTGUI.OneToOne.IDLE_HELP_TIMEOUT) !== 0) {

            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (restart) {

                idleTimerID = setTimeout(onIdleTimerTimeout, GTGUI.OneToOne.IDLE_HELP_TIMEOUT);
            }
        }
    };

    /*
     *
     * @returns {undefined}
     */
    function onIdleTimerTimeout() {

        idleTimerID = 0;
        closeCallback("TIMEOUT");
    };
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// GAME ZONE
// -----------------------------------------------------------------------------
GTGUI.OneToOne.GameZone = function() {

    var mainElement = null;
    var blocker = null;
    var textElement = null;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        blocker = null;
        textElement = null;

        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;
    };

    /*
     *
     * @returns {GTGUI.OneToOne.GameZone.mainElement|Element}
     */
    this.create = function() {

        var element;

        mainElement = document.createElement("div");
        mainElement.className = "gameZoneArea";
        mainElement.style.zIndex = "1";

        //element = document.createElement("div");
        //element.className = "gameZoneOnlineTextArea";
        //element.style.zIndex = "51";

        //mainElement.appendChild(element);

        //textElement = document.createElement("div");
        //textElement.className = "gameZoneOnlineText";

        //element.appendChild(textElement);

        blocker = document.createElement("div");
        blocker.className = "gameZoneAreaBlocker";
        blocker.style.zIndex = "100";

        mainElement.appendChild(blocker);

        return mainElement;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        /*if (deviceInfo.printerStatus === "noError" || deviceInfo.printerStatus === "paperLow") {

            textElement.innerHTML = GTGUI.Language.get("PRINTER_PAPER_LOW");
        }
        else if (deviceInfo.printerStatus === "noPaper") {

            textElement.innerHTML = GTGUI.Language.get("PRINTER_PAPER_OUT");
        }
        else {

            textElement.innerHTML = GTGUI.Language.get("PRINTER_ERROR");
        }*/
    };

    this.append = function(element) {

        mainElement.appendChild(element);
    };

    /*
     *
     * @returns {GTGUI.OneToOne.GameZone.mainElement}
     */
    this.mainElement = function() {

        return mainElement;
    };
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// PROMPT ZONE
// -----------------------------------------------------------------------------
GTGUI.OneToOne.PromptZone = function() {

    var mainElement = null;
    var promptElement = null;
    var creditTextElement = null;
    var creditsTextElement = null;
    var buttonElements = null;
    var button1 = null;
    var button2 = null;
    var button3 = null;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        promptElement = null;
        creditTextElement = null;
        creditsTextElement = null;
        buttonElements = null;
        button1 = null;
        button2 = null;
        button3 = null;

        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;
    };

    /*
     *
     * @returns {GTGUI.OneToOne.PromptZone.mainElement|Element}
     */
    this.create = function() {

        var plaque;
        var index;
    
        mainElement = document.createElement("div");
        mainElement.className = "promptArea";
        mainElement.style.zIndex = "2";

        promptElement = document.createElement("div");
        promptElement.className = "promptAreaPrompt";

        mainElement.appendChild(promptElement);

        plaque = document.createElement("div");
        plaque.className = "promptAreaCreditPlaque";

        mainElement.appendChild(plaque);

        creditTextElement = document.createElement("div");
        creditTextElement.className = "promptAreaCredits";

        plaque.appendChild(creditTextElement);

        creditsTextElement = document.createElement("div");
        creditsTextElement.className = "promptAreaCreditText";

        plaque.appendChild(creditsTextElement);

        buttonElements = document.createElement("div");
        buttonElements.className = "promptAreaButtons";

        plaque.appendChild(buttonElements);

        button1 = document.createElement("button");
        button1.className = "promptAreaButtonFlip";
        button1.value = "FLIP";

        plaque.appendChild(button1);

        buttonCashLess = document.createElement("button");
        buttonCashLess.id ="cashLessBtn";
        buttonCashLess.className = "promptAreaCashLess";
        buttonCashLess.value = "CASHLESS";

        buttonElements.appendChild(buttonCashLess);

        cashlessMessage = document.createElement("div");
        cashlessMessage.className = "promptAreaCashLessMessage";
        cashlessMessage.innerHTML = GTGUI.Language.get("CASHLESS_MESSAGE");

        plaque.appendChild(cashlessMessage);

        creditButtonElement = document.createElement("button");
        creditButtonElement.value = "CREDITS";
        creditButtonElement.className = "promptAreaCreditButton";

        plaque.appendChild(creditButtonElement);


        button2 = document.createElement("button");
        button2.className = "promptAreaButtonHelp";
        button2.value = "HELP";

        plaque.appendChild(button2);

        button3 = document.createElement("button");
        button3.className = "promptAreaButtonLanguage";
        button3.value = "LANGUAGE";

        plaque.appendChild(button3);

        return mainElement;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        var currentPrompt;
        var currentArgs;


        if (deviceInfo === null || (deviceInfo.deviceStatus.indexOf("enabled") === -1) || ((deviceInfo.deviceStatus === "disabledNoInventory" && deviceState.noOnlineGames === true))) {

            if (deviceInfo.deviceStatus === "disabledInitializing") {

                currentPrompt = "PROMPT_INITIALIZING";
            }
            else if (deviceInfo.deviceStatus === "disabledNoInventory" && deviceState.noOnlineGames === true) {

                currentPrompt = "PROMPT_OUT_OF_SERVICE";
            }
            else if (deviceInfo.deviceStatus === "NOT_CONNECTED") {

                currentPrompt = "PROMPT_NOT_CONNECTED";
            }
            else {

                currentPrompt = "PROMPT_SEE_RETAILER";
            }
        }

        else if (deviceState.ageVerification === true && deviceState.ageVerified === false && (deviceInfo.printerStatus === "noError" || deviceInfo.printerStatus === "paperLow")) {

            currentPrompt = "PROMPT_VERIFY_AGE";
        }

        else if (deviceInfo.credits > 0 && deviceState.cashlessPrivilege === false) {

            // if (deviceState.billAcceptorOkay === false && (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable"))
            if (deviceState.billAcceptorOkay === false || (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed"))  {

                if (deviceState.billAcceptorOkay === false && (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed") && deviceState.ageVerification === true && deviceState.ageVerificationNotBypassed === true) {

                    currentPrompt = "PROMPT_VERIFY_AGE";

                } else {

                    if (deviceState.billAcceptorOkay === false && (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed")){

                        currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL_WITH_CREDITS";

                    }
                    switch (deviceInfo.billAcceptorStatus) {

                        case "full":
                            currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL_WITH_CREDITS";
                            break;

                        case "jammed":
                            currentPrompt = "PROMPT_BILL_ACCEPTOR_JAMMED";
                            break;

                        default:
                            currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL_WITH_CREDITS";
                            break;
                    }

                    if (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed") {
                        switch (deviceInfo.coinAcceptorStatus) {

                            case "jammed":
                                currentPrompt = "PROMPT_COIN_ACCEPTOR_JAMMED";
                                break;

                            default:
                                currentPrompt = "PROMPT_COIN_ACCEPTOR_ERROR";
                                break
                        }
                    }
                }
            }

            else if (deviceState.vendErrorMessage) {
                if(deviceInfo.onlineGames.length > 0){
                    currentPrompt = "PROMPT_ERROR_SELECT_ANOTHER_TICKET";
                } else {
                    currentPrompt = "PROMPT_ERROR_DRAW_GAME_UNAVAILABLE";
                }
            }

            else if (deviceState.vending) {

                currentPrompt = "PROMPT_VENDING";
            }

            else if ((deviceInfo.printerStatus !== "noError" && deviceInfo.printerStatus !== "paperLow") || deviceInfo.printerStatus === "noPaper") {
                if (deviceInfo.printerStatus === "noPaper") {

                    currentPrompt = "PRINTER_PAPER_OUT";
                }
                else {
                    currentPrompt = "PRINTER_ERROR";
                }
            }

            else {
                //var maxCredit = parseFloat(deviceInfo.configuration.max_credit.substr(3));
                //if (deviceInfo.credits > maxCredit) {
//                 if (deviceState.creditMaxed) {

//                     currentPrompt = "PROMPT_SELECT_GAME_MAX_CREDITS";
//                     currentArgs = GTGUI.Language.getCurrency(deviceInfo.configuration.max_credit);
//                 }
//                 else {

                    if (deviceState.gameObjectPresented !== null) {

                        currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                    }
                    else {

                        currentPrompt = "PROMPT_CHOOSE_GAME";
                    }
//                 }
            }
        }

        else {

            // CASHLESS: Verifed that cashless_privilege is the correct way to determine if cashless exists on machine
            // We can also used min_cashless_amount

            if (deviceState.cashlessPrivilege) {

                if (deviceState.cashless.sessionStart === true && deviceState.cashless.sessionAmount !== 0) {

                    if (deviceState.cashless.eventAuthorizeInit === true) {

                        currentPrompt = "PROMPT_SWIPE_CARD";
                    }
                    else if (deviceState.cashless.authorizeSuccess) {

                        if (deviceState.gameObjectPresented !== null) {
                            if (deviceState.vending) {

                                currentPrompt = "PROMPT_VENDING";
                            }
                            else {

                                currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                            }    
                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_GAME";
                        }    

                    }    
                    else {

                        currentPrompt = "PROMPT_SWIPE_CARD";
                    }
                }
                else if (deviceState.reinvest === true) {

                        if (deviceState.gameObjectPresented !== null) {
                            
                            if (deviceState.vending) {

                                currentPrompt = "PROMPT_VENDING";
                            }
                            else {

                                currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                            }
                        
                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_GAME";
                        }    
                         
                }
                else {

                    if (deviceInfo.credits !== 0) {
                        
                        if (deviceState.gameObjectPresented !== null) {

                            if (deviceState.vending) {

                                currentPrompt = "PROMPT_VENDING";
                            }
                            else {
                                currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                            }

                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_GAME";
                        }
                       
                    }
                    else {
                        currentPrompt = "PROMPT_CASHLESS";
                    }
                     
                    
                }

                 
            }
            else {

                if (deviceInfo.credits === 0) {

                    currentPrompt = "PROMPT_INSERT_MONEY";
                }
                else {

                    if (deviceState.gameObjectPresented !== null) {
                        if (deviceState.vending) {
                            currentPrompt = "PROMPT_VENDING";
                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                        }   
                    
                    }
                    else {
                        currentPrompt = "PROMPT_CHOOSE_GAME";
                    }   

                    
                }
                  
                      
            }

            // CASHLESS: If SESSION_ERROR, show appropriate prompt(s).

            if (deviceState.cashless.eventSessionError === true) {

                if (deviceInfo.credits === 0) {

                    currentPrompt = "PROMPT_CASHLESS_SESSION_ERROR";
                
                }
                else {

                     if (deviceState.gameObjectPresented !== null) {
                        if (deviceState.vending) {
                            currentPrompt = "PROMPT_VENDING";
                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                        }   
                    
                    } 
                    else {
                        currentPrompt = "PROMPT_CHOOSE_GAME";
                    } 

                }    
        
                
            }

            if (deviceState.cashless.endOfDay === true) {

                if (deviceInfo.credits === 0) {

                    currentPrompt = "PROMPT_INSERT_MONEY";
                }
                else {

                    if (deviceState.gameObjectPresented !== null) {
                        if (deviceState.vending) {
                            currentPrompt = "PROMPT_VENDING";
                        }
                        else {
                            currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                        }   
                    
                    } 
                    else {
                        currentPrompt = "PROMPT_CHOOSE_GAME";
                    }   

                    
                }

            }

            if (deviceState.billAcceptorOkay === false || (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed")) {

               if (deviceState.cashlessPrivilege) {

                    if (deviceState.cashless.sessionStart) {

                        if (deviceState.cashless.eventAuthorizeInit) {
                            
                            currentPrompt = "PROMPT_SWIPE_CARD";
                        
                        }    
                        else {

                            if (deviceState.cashless.authorizeSuccess) {

                                if (deviceState.gameObjectPresented !== null) {
                                    if (deviceState.vending) {

                                        currentPrompt = "PROMPT_VENDING";
                                    }
                                    else {

                                        currentPrompt = "PROMPT_CHOOSE_AMOUNT";
                                    }    
                                }
                                else {
                                    currentPrompt = "PROMPT_CHOOSE_GAME";
                                }
                            }
                            else {

                            }    

                        }    
                    }
                    else {

                        if (deviceState.cashless.sessionStart === false && deviceInfo.credits !==0) {

                            currentPrompt = "PROMPT_CHOOSE_GAME";
                        }
                        else {

                            currentPrompt = "PROMPT_CASHLESS_PAY_WITH_CARD"; 
                        }
                    }    

               } 

               else {

                   switch (deviceInfo.billAcceptorStatus) {

                        case "full":
                            currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL";
                            break;

                        case "jammed":
                            currentPrompt = "PROMPT_BILL_ACCEPTOR_JAMMED";
                            break;

                       case "billAcceptorDisabled":
                           currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL";
                           break;

                        default:
                            if (deviceState.coinAcceptorOkay === false){
                                currentPrompt = "PROMPT_BILL_ACCEPTOR_ERROR";
                            } else {
                                currentPrompt = "PROMPT_BILL_ACCEPTOR_FULL";
                            }

                            break;
                   }

                   if (deviceState.coinAcceptorOkay === false || deviceInfo.coinAcceptorStatus === "notAvailable" || deviceInfo.coinDoor === "removed") {

                       switch (deviceInfo.coinAcceptorStatus) {

                           case "jammed":
                               currentPrompt = "PROMPT_COIN_ACCEPTOR_JAMMED";
                               break;

                           default:
                               currentPrompt = "PROMPT_COIN_ACCEPTOR_ERROR";
                               break;
                       }
                   }
                }
            }

            if ((deviceInfo.printerStatus !== "noError" && deviceInfo.printerStatus !== "paperLow") || deviceInfo.printerStatus === "noPaper") {
                if (deviceInfo.printerStatus === "noPaper") {

                    currentPrompt = "PRINTER_PAPER_OUT";
                }
                else {
                    currentPrompt = "PRINTER_ERROR";
                }
            }
        }


        promptElement.innerHTML = GTGUI.Language.get(currentPrompt, currentArgs);
        creditTextElement.innerHTML = GTGUI.Language.get("AVAILABLE_CREDIT");
        creditsTextElement.innerHTML = GTGUI.Language.getCurrency(deviceInfo.credits);
        button1.innerHTML =  GTGUI.Language.get("FLIP");

        if (deviceState.cashlessPrivilege === false || deviceInfo.credits !==0) {
            
            buttonCashLess.className = "promptAreaCashLessHidden";
            cashlessMessage.className = "promptAreaCashLessMessageHidden";    
        }
        else {
        
            if (deviceState.ageVerification === true && deviceState.ageVerified === false) {
            
                buttonCashLess.className = "promptAreaCashLessHidden";
                cashlessMessage.className = "promptAreaCashLessMessageHidden";
        
            }
            else {

                if (deviceState.cashless.sessionStart === true || deviceState.reinvest === true) {

                    buttonCashLess.className = "promptAreaCashLessHidden";

                    if (deviceState.cashless.sessionAmount !== 0) {

                        cashlessMessage.className = "promptAreaCashLessMessage";
                    }
                    
                    
                    if (deviceState.cashless.authorizeSuccess === true || deviceInfo.credits > 0) {

                        cashlessMessage.className = "promptAreaCashLessMessageHidden";
                    }

                    if (deviceInfo === null || (deviceInfo.deviceStatus.indexOf("enabled") === -1)) {
                        buttonCashLess.className = "promptAreaCashLessHidden";
                    }


                    
                }
                else {

                    if (deviceState.cashless.eventSessionError === true || deviceState.cashless.endOfDay === true ||
                        (deviceInfo.deviceStatus.indexOf("enabled") === -1) || deviceState.cashless.sessionTerminated === true) {

                        buttonCashLess.disabled = true;
                        buttonCashLess.innerHTML = GTGUI.Language.get("CASHLESS");
                        buttonCashLess.value = "CASHLESS";
                        if (deviceState.reinvest === false) {
                            buttonCashLess.className = "promptAreaCashLess"; 
                            
                        }
                        else {
                           buttonCashLess.className = "promptAreaCashLessHidden";
                        }
                        
                        cashlessMessage.className = "promptAreaCashLessMessageHidden";
                    }
                    else {
                        
                        buttonCashLess.disabled = false;
                        buttonCashLess.innerHTML = GTGUI.Language.get("CASHLESS");
                        buttonCashLess.value = "CASHLESS";
                        if (deviceState.reinvest === false) {
                            buttonCashLess.className = "promptAreaCashLess"; 
                            
                        }
                        else {
                           buttonCashLess.className = "promptAreaCashLessHidden";
                        }
                        cashlessMessage.className = "promptAreaCashLessMessageHidden";
                    }
                }    
            }    
        }       


        button2.innerHTML = GTGUI.Language.get("HELP");
        button3.innerHTML = GTGUI.Language.get("LANGUAGE");


    };

    /*
     *
     * @returns {GTGUI.OneToOne.PromptZone.mainElement}
     */
    this.mainElement = function() {

        return mainElement;
    };

    /*
     *
     * @returns {unresolved}
     */
    this.getPosition = function() {

        return mainElement.getBoundingClientRect();
    };
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// PRESENTER
// -----------------------------------------------------------------------------
GTGUI.OneToOne.Presenter = function() {

    GTGUI.Observable.call(this);

    var _self = this;

    var mainElement = null;
    var mainElement2 = null;
    var gameImageElement = null;
    var closeElement = null;
    var infoElement = null;
    var textElement = null;
    var infoBoxElement = null;
    var infoBoxCloseElement = null;
    var gameOptions = null;
    var gameOptionElements = [];
    var idleTimerID = 0;
    var gameObjectReference = null;
    var showingOptions = false;
    var vendingCount = 0;
    var closeCallback = null;
    var pyoElement = null;
    var pyoHTMLFileName = null;
    var pyoButtonElement = null;

    /*
     *
     * @param {type} responseObj
     * @returns {undefined}
     */
    this.quickPickResponse = function(responseObj)
    {
        // send data to pyo response handler
        pyoElement.contentWindow.quickPickResponse(responseObj);
    };

    /*
     *
     * @returns {undefined}
     */
    this.pyoCancelCheck = function() {

        if (pyoElement !== null) {

            pyoElement.contentWindow.cancelRequest();
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        if (gameObjectReference !== null) {

            gameObjectReference.clearPresentableImage();
            gameObjectReference = null;
        }

        gameOptionElements = null;
        gameOptions = null;
        gameImageElement = null;

        closeElement = null;
        infoElement = null;
        textElement = null;
        infoBoxElement = null;
        infoBoxCloseElement = null;

        closeCallback = null;

        if (pyoElement !== null) {

            pyoElement = null;
        }

        // Remove PYO event listener
        window.removeEventListener("message", pyoEvents, false);

        // Remove HTML
        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;

        mainElement2.parentNode.removeChild(mainElement2);
        mainElement2 = null;

        _self = null;
    };

    /*
     *
     * @param {type} gameObject
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} parent
     * @param {type} callback
     * @returns {undefined}
     */
    this.create = function(gameObject, deviceInfo, deviceState, parent, callback) {

		console.log("Create Presenter");

        var promptPosition, gamePosition, top, game, index, nodes, node;

        // Save the close callback reference
        closeCallback = callback;

        // Listen for PYO events
        window.addEventListener("message", pyoEvents, false);

        // Set the presented element on the game
        gameObjectReference = gameObject;
        game = gameObjectReference.game();
        gameOptions = gameObjectReference.gameOptions();
        pyoHTMLFileName = gameOptions.pyoHTML;

        // Get copy of the game image, and position/size
        gameImageElement = gameObjectReference.getPresentableImage();
        gamePosition = gameObjectReference.getPosition();

        // Get the prompts location
        promptPosition = document.getElementsByClassName("promptArea")[0].getBoundingClientRect();

        // Create the game zone...
        mainElement = document.createElement("div");
        mainElement.className = "presenterZone";
        mainElement.style.zIndex = "10";
        console.log("NUMBER OF INSTANT BINS");
        console.log(deviceInfo.configuration.number_of_instant_bins);
        mainElement.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
        mainElement.setAttribute("data-position", (gamePosition.top > promptPosition.top ? "bottom" : "top"));

        parent.appendChild(mainElement);

        mainElement2 = document.createElement("div");
        mainElement2.className = "presenterZone";
        mainElement2.style.zIndex = "5";
        mainElement2.setAttribute("data-position", (gamePosition.top > promptPosition.top? "top" : "bottom"));
        mainElement2.style.display = "none";

        parent.appendChild(mainElement2);

        infoBoxElement = document.createElement("div");
        infoBoxElement.className = "presenterInformationArea";
        infoBoxElement.zIndex = "1";

        mainElement2.appendChild(infoBoxElement);

        infoBoxCloseElement = document.createElement("button");
        infoBoxCloseElement.className = "presenterInformationAreaClose";
        infoBoxCloseElement.zIndex = "2";
        infoBoxCloseElement.value = "PRESENTER_INFO_CLOSE";

        mainElement2.appendChild(infoBoxCloseElement);

        gamePosition = gameObjectReference.getImagePosition();

        gameImageElement.style.position = "absolute";
        gameImageElement.style.top = (gamePosition.top).toString() + 'px';
        gameImageElement.style.left = (gamePosition.left).toString() + 'px';
        gameImageElement.style.width = (gamePosition.width).toString() + 'px';
        gameImageElement.style.height = (gamePosition.height).toString() + 'px';
        gameImageElement.style.zIndex = "10";
        gameImageElement.value = "PRESENTER_INFO";
        gameImageElement.onclick = null;
        gameImageElement.style.pointerEvents = "none";

        mainElement.appendChild(gameImageElement);

        nodes = mainElement.children;

        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-game", game.gameId);
            node.setAttribute("data-gametype", game.gameType);
            node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
        }

        if (gameObjectReference.quickSell() === false) {

            // Present the game
            gameObjectReference.present(function() {

                position = gameImageElement.getBoundingClientRect();

                textElement = document.createElement("div");
                textElement.className = "presenterTitle";
                textElement.style.zIndex = "1";

                mainElement.appendChild(textElement);

                infoElement = document.createElement("button");
                infoElement.className = "presenterInfoButton";
                infoElement.style.zIndex = "20";
                infoElement.value = "PRESENTER_INFO";

                mainElement.appendChild(infoElement);

                infoElement.style.top = (gameImageElement.offsetTop - (infoElement.offsetHeight >> 1)).toString() + 'px';
                infoElement.style.left = ((gameImageElement.offsetLeft + gameImageElement.offsetWidth) - (infoElement.offsetWidth >> 1)).toString() + 'px';

                closeElement = document.createElement("button");
                closeElement.className = "presenterCloseButton";
                closeElement.style.zIndex = "20";
                closeElement.value = "PRESENTER_CLOSE";

                mainElement.appendChild(closeElement);

                closeElement.style.top = (gameImageElement.offsetTop - (closeElement.offsetHeight >> 1)).toString() + 'px';
                closeElement.style.left = (gameImageElement.offsetLeft - (closeElement.offsetWidth >> 1)).toString() + 'px';

                // This hidden button is used to send clicks to the layout
                // but it is never seen.
                pyoButtonElement = document.createElement("BUTTON");
                pyoButtonElement.className = "";
                pyoButtonElement.style.display = "none";
                pyoButtonElement.style.left = "-100px";
                pyoButtonElement.value = "PYO_CLICK";

                mainElement.appendChild(pyoButtonElement);

                // Create the options
                createOptions(deviceInfo, deviceState);

                // Force a reflow so the above changes take effect
                mainElement.offsetHeight;

                mainElement.setAttribute("data-game", game.gameId);
                mainElement.setAttribute("data-gametype", game.gameType);
                mainElement.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);

                nodes = mainElement.getElementsByTagName("*");

                for (index = 0; index < nodes.length; index++) {

                    node = nodes[index];
                    node.setAttribute("data-game", game.gameId);
                    node.setAttribute("data-gametype", game.gameType);
                    node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
                }

                // Get the last updated style before updating the presented... flush CSS Cache
                //window.getComputedStyle(gameOptionElements[gameOptionElements.length - 1].line).height;

                //mainElement2.style.display = "block";

                _self.update(deviceInfo, deviceState);

                mainElement.onclick = buttonClickHandler;
                mainElement2.onclick = buttonClickHandler;

                gameImageElement.style.pointerEvents = "auto";
            });
        }
        else {

            quickSell(deviceInfo, deviceState);
        }
    };

    /*
     *
     * @param {type} event
     * @returns {Boolean}
     */
    function stopPropagation(event) {

        event.stopPropagation();
        return false;
    }

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    function quickSell(deviceInfo, deviceState) {

        var ticketPrice = parseFloat(gameObjectReference.game().ticketPrice.substr(3));
        var available = (deviceInfo.credits >= ticketPrice);

        //gameImageElement.setAttribute("data-available", available);
        gameImageElement.setAttribute("data-information", available);
        gameImageElement.dataset.count = 1;
        gameImageElement.dataset.cost = ticketPrice;
        gameImageElement.dataset.addOn = false;
        gameImageElement.dataset.quicksell = true;
        gameImageElement.value = "PRESENTER_SELECTION_QUICK_SELL";
        gameImageElement.noclick = true;

        vendingCount = 1;

        gameImageElement.click();
    }

    /*
     *
     * @returns {undefined}
     */
    function createOptions(deviceInfo, deviceState) {

        var degree = 25, angle = 0, rad = 0.01745277778;
        var index = 0;
        var cx = mainElement.offsetWidth >> 1;
        var cy = mainElement.offsetHeight >> 1;
        var button = null;
        var gameData = null;
        var optionProperty = null;
        var optionCount = 0;
        var optionValue, property, pyoOption, addOnOption;
        var ticketPrice;
        
        console.log("createOptions");

        var game = gameObjectReference.game();
        var gameOptionInfo = gameOptions.info;
        var inventory = game.currentInventory;
        console.log(game);
        console.log(gameOptionInfo);
        // Create data object and set common values
        gameData = {};

        gameData.game = game.gameId;
        gameData.gameType = game.gameType;
        gameData.binNumber = game.binNumber;
        gameData.confirmation = false;

        // This will get overriden by PYO
        gameData.type = "quickpick";

        // Copy the game option information to the data object
        for (property in gameOptionInfo) {

            if (gameOptionInfo.hasOwnProperty(property) && gameOptionInfo[property] !== "") {

                gameData[property] = gameOptionInfo[property];

                // Only accept the first arrayed value
                if (optionProperty === null && Array.isArray(gameData[property])) {

                    optionProperty = property;
                }
            }
        }

        // Get the optionCount based on the game type
        if (gameData.gameType === GTGUI.GAME_TYPE.ONLINE) {

            // Set the gameId
            gameData.gameId = game.onlineGameId;

            // Based on the option property values
            optionCount = gameData[optionProperty].length;
        }
        else {

            // Set the gameId
            gameData.gameId = game.gameId;

            // Based on the inventory and ticket count
            for (index = 0; index < gameData[optionProperty].length; index++) {

                var count = parseInt(gameData[optionProperty][index]);
                var low = parseInt(gameData.lowTicketCount);

                if (count <= inventory) {

                    if (inventory <= low) {

                        if (count < low) {

                            optionCount++;
                        }
                    }
                    else {

                        optionCount++;
                    }
                }
            }
        }

        // Add on flag
        addOnOption = (gameOptions.info.addOn === "true");
        pyoOption = (gameOptions.info.pickYourOwn === "true");

        // Get the base cost of the ticket
        if (gameData.ticketPrice === "PARAM") {

            if (game.gameId === "Sampler") {

                ticketPrice = parseFloat(deviceInfo.samplers[0].parameters.amount.substr(3));
            }
            else {

                // NOT USED YET
                ticketPrice = "n/a";
            }
        }
        else {

            ticketPrice = parseFloat(game.ticketPrice.substr(3));
        }

        // Pick your own option button
        if (pyoOption) {

            angle = 90 * rad;

            button = createOptionInfo(angle, cx, cy, 0, true, 190);
            button.gameData = GTGUI.ObjectCopy(gameData);

            gameOptionElements.push(button);
        }

        if (addOnOption) {

            angle = 90 + ((optionCount - 1) * degree);
            offset = -125;
        }
        else {

            var difference = -1;

            if (pyoOption) {

                difference = ((optionCount % 2) === 0 ? 1 : 0);
            }

            angle = 90 + (((optionCount + difference) / 2) * degree);
            offset = 0;
        }

        // Create all the options based on the option property used
        for (index = 0; index < optionCount; index++) {

            var offset;

            if (pyoOption && !addOnOption && angle < 125) {

                angle -= (2 * degree);
                pyoOption = false;
            }

            // Create the options and use JSON to create a cop of base data
            button = createOptionInfo((angle * rad), cx, cy, offset, false, 265);
            button.gameData = GTGUI.ObjectCopy(gameData);

            // Get the first option property value
            optionValue = button.gameData[optionProperty][index];

            // Setup the data baseed on the opertion propery and value...
            if (optionProperty === "numberOfTickets") {

                button.gameData.numberOfTickets = optionValue;
                button.gameData.totalCost = (optionValue * ticketPrice);
                button.gameData.infoText = GTGUI.Language.getCurrency(parseFloat(button.gameData.totalCost), false);
                button.gameData.valueText = optionValue;
                textMessage = "PRESENTER_QUANITY";
            }
            else if (optionProperty === "numberOfBoards") {

                button.gameData.numberOfBoards = optionValue * parseInt(button.gameData.boardCount);
                button.gameData.powerPlay = false;
                button.gameData.totalCost = (optionValue * ticketPrice);
                button.gameData.infoText = button.gameData.numberOfBoards + " " + GTGUI.Language.get((button.gameData.numberOfBoards === 1 ? "PLAY" : "PLAYS"));
                button.gameData.valueText = GTGUI.Language.getCurrency(parseFloat(button.gameData.totalCost), false);
                textMessage = "PRESENTER_AMOUNT";
            }
            else if (optionProperty === "numSpots") {

                button.gameData.numberOfSpots = optionValue;
                button.gameData.totalCost = ticketPrice;
                button.gameData.valueText = optionValue + "</br>" + GTGUI.Language.get((optionValue === "1" ? "SPOT" : "SPOTS"));
                button.gameData.infoText = "";
                button.setAttribute("data-type", "numSpots");
                button.childNodes[0].setAttribute("data-type", "numSpots");
                button.childNodes[1].setAttribute("data-type", "numSpots");
                textMessage = "PRESENTER_SPOTS";
            }
            else if (optionProperty === "gameBetType") {

                button.gameData.betType = optionValue;
                button.gameData.totalCost = ticketPrice;
                button.gameData.valueText = GTGUI.Language.get("TEXT_" + optionValue);
                button.setAttribute("data-type", "betType");
                button.childNodes[0].setAttribute("data-type", "betType");
                button.childNodes[1].setAttribute("data-type", "betType");
                textMessage = "PRESENTER_BETTYPE";
            }
            else if (optionProperty === "betAmount") {

                button.gameData.betAmount = "[" + optionValue + "]";
                button.gameData.totalCost = optionValue.substr(3);
                button.gameData.valueText = GTGUI.Language.getCurrency(parseFloat(button.gameData.totalCost), false);
                button.gameData.infoText = "1 " + GTGUI.Language.get("PLAY");
                textMessage = "PRESENTER_BETAMOUNT";
            }
            else {

                button.gameData.valueText = "n/a";
                button.gameData.infoText = "undefined";
            }

            gameOptionElements.push(button);

            // If there are addons, create addon button
            if (gameData.addOn === "true") {

                // Create the options and use JSON to create a cop of base data
                //button = createOptionInfo(angle, cx, cy, 125, false);
                button = createOptionInfo(((90 - (index * degree)) * rad), cx, cy, 125, false, 265);

                button.gameData = GTGUI.ObjectCopy(gameData);

                button.gameData.totalCost = (optionValue * (ticketPrice + parseFloat(gameData.addOnCost.substr(3))));
                button.gameData.powerPlay = true;
                button.gameData.numberOfBoards = optionValue;
                button.gameData.infoText = optionValue + " " + GTGUI.Language.get((optionValue === 1 ? "PLAY" : "PLAYS"));
                button.gameData.valueText = GTGUI.Language.getCurrency(parseFloat(button.gameData.totalCost), false);

                button.setAttribute("data-type", "addon");
                button.animationInfo.line.setAttribute("data-type", "addon");

                gameOptionElements.push(button);
            };

            angle -= degree;

        };

        // Create the low ticket indicator for instant games
        if (inventory <= gameOptionInfo.lowTicketCount) {

            angle = (0 - (0 * degree)) * rad;

            button = createOptionInfo(angle, cx, cy, 0, false);
            button.gameData = GTGUI.ObjectCopy(gameData);
            button.gameData.numberOfBoards = inventory;
            button.gameData.totalCost = (inventory * ticketPrice);
            button.gameData.infoText = GTGUI.Language.getCurrency(parseFloat(button.gameData.totalCost), false);
            button.gameData.valueText = inventory;
            button.setAttribute("data-type", "bonus");
            button.animationInfo.line.setAttribute("data-type", "bonus");

            gameOptionElements.push(button);
        };
    };

    /*
     *
     * @param {type} angle
     * @param {type} cx
     * @param {type} cy
     * @param {type} offset
     * @param {type} pyo
     * @param {type} length
     * @returns {GTGUI.OneToOne.Presenter.createOptionInfo.button}
     */
    function createOptionInfo(angle, cx, cy, offset, pyo, length) {

        var button, element;

        if (pyo === false) {

            button = document.createElement("button");
            button.className = "presenterOptionButton";
            button.value = "PRESENTER_SELECTION";
            button.style.top = (cy).toString() + "px";
            button.style.left = (cx + offset).toString() + "px";
            button.style.zIndex = "5";

            mainElement.appendChild(button);

            element = document.createElement("div");
            element.className = "presenterOptionButtonText";

            button.appendChild(element);

            element = document.createElement("div");
            element.className = "presenterOptionButtonInfoDisplay";

            button.appendChild(element);
        }
        else {

            button = document.createElement("button");
            button.className = "presenterOptionPYOButton";
            button.value = "PRESENTER_PICK_YOUR_OWN";
            button.style.top = (cy).toString() + "px";
            button.style.left = (cx + offset - 80).toString() + "px";
            button.innerHTML = GTGUI.Language.get("BUTTON_PYO");
            button.style.zIndex = "5";

            mainElement.appendChild(button);
        }

        button.animationInfo = {

            offsetX : Math.ceil((Math.cos(angle) * length)),
            offsetY : Math.ceil((Math.sin(angle) * length)),
            lineX : (cx + offset),
            lineY : cy
        };

        // Readjust the button to centered on position once it has been added to the dom
        button.animationInfo.buttonX = Math.ceil((((cx + offset) - (button.offsetWidth >> 1)) >> 1) << 1);
        button.animationInfo.buttonY = Math.ceil(((cy - (button.offsetHeight >> 1)) >> 1 ) << 1);

        button.style.top = (button.animationInfo.buttonY).toString() + "px";
        button.style.left = (button.animationInfo.buttonX).toString() + "px";

        element = document.createElement("div");
        element.className = "presenterOptionLine";
        element.style.top = (button.animationInfo.lineY).toString() + "px";
        element.style.left = (button.animationInfo.lineX).toString() + "px";
        element.style.height = "0px";
        element.style.zIndex = "4";

        mainElement.appendChild(element);

        button.animationInfo.line = element;

        return button;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        var text, buttonElement, index;

        if (gameObjectReference === null)
            return;

        // CASHLESS If cashless session true as well, don't resetIdleTimer
        if (deviceState.help || deviceState.cashless.sessionStart === true)  {

            resetIdleTimer();
        }
        else {

            if (vendingCount === 0) {

                resetIdleTimer(true);
            }
        }

        // Loop through all the options and update text accordingly
        for (index = 0; index < gameOptionElements.length; index++) {

            // Get the button
            buttonElement = gameOptionElements[index];
            buttonElement.setAttribute("data-available", (deviceInfo.credits >= buttonElement.gameData.totalCost));

            if (buttonElement.children[0] !== undefined) {

                buttonElement.children[0].innerHTML = buttonElement.gameData.valueText;
            }

            if (buttonElement.children[1] !== undefined) {

                buttonElement.children[1].innerHTML = GTGUI.Language.getCurrency(parseFloat(buttonElement.gameData.totalCost), false);
            }
        }

        if (textElement !== null) {

            // Update title
            if (deviceState.ageVerification === true && deviceState.ageVerified === false) {

                text = GTGUI.Language.get("PRESENTER_VERIFY_AGE");
            }
            else if (deviceInfo.credits === 0) {
                
                if (deviceState.cashlessPrivilege) {

                    text = GTGUI.Language.get("PRESENTER_NO_CREDITS_CASHLESS");
                    
                }
                else {

                    text = GTGUI.Language.get("PRESENTER_NO_CREDITS");
                    
                }    
                    
            }
            else {

                if (deviceState.vending) {

                    text = GTGUI.Language.get("PROMPT_VENDING");
                }
                else {

                    text = GTGUI.Language.get(textMessage);
                }
            }

            textElement.innerHTML = text;

            if (showingOptions === false) {

                showOptionsAnimation();
            }
        }

        if (infoBoxElement !== null) {

            if (gameOptions.gameInfo !== undefined && gameOptions.gameInfo !== "") {

                if (gameOptions.gameInfo.search(".html") === -1) {

                    infoBoxElement.style.backgroundImage = GTGUI.Language.getFileUrl(gameOptions.gameInfo);
                }
                else {

                    infoBoxElement.innerHTML='<object class="presenterInformationAreaLoadedObject" type="text/html" data="' + GTGUI.Language.getFile(gameOptions.gameInfo) + '" ></object>';
                }
            }
        }

        if (pyoElement !== null) {

            //gameImageElement.style.display = "none";
            //pyoElement.style.display = "block";

            if (pyoElement.contentWindow.hasOwnProperty("update")) {

                pyoElement.contentWindow.update(deviceInfo, deviceState, gameObjectReference);
            }
        }
    };

    /*
     *
     * @returns {undefined}
     */
    function showOptionsAnimation() {

        var length, angle;
        var offsetX, offsetY;
        var element, index;
        var radians = 180 / 3.1415;

        if (gameOptionElements.length > 0) {

            showingOptions = true;
            resetIdleTimer(true);

            for (index = 0; index < gameOptionElements.length; index++) {

                element = gameOptionElements[index];

                offsetX = element.animationInfo.offsetX;
                offsetY = element.animationInfo.offsetY;

                // Position/rotate the line
                length = Math.sqrt((offsetX * offsetX) + (offsetY * offsetY));
                angle = radians * Math.acos(offsetY / length);

                if ((offsetX + element.animationInfo.lineX) > element.animationInfo.lineX) {

                    angle *= -1;
                }

                element.animationInfo.line.style.webkitTransform = "rotate(" + angle + "deg)";
                element.animationInfo.line.style.height = (length).toString() + "px";

                x = Math.ceil((((element.animationInfo.lineX) - (element.offsetWidth >> 1)) >> 1) << 1);
                y = Math.ceil((((element.animationInfo.lineY) - (element.offsetHeight >> 1)) >> 1 ) << 1);

                element.style.top = (y + offsetY).toString() + "px";
                element.style.left = (x + offsetX).toString() + "px";
            }

            resetIdleTimer(true);
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.flip = function() {

        var current = mainElement.getAttribute("data-position");

        if (current === "top") {

            mainElement.setAttribute("data-position", "bottom");
            mainElement2.setAttribute("data-position", "top");
        }
        else {

            mainElement.setAttribute("data-position", "top");
            mainElement2.setAttribute("data-position", "bottom");
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.vend = function() {

        vendingCount--;
        resetIdleTimer(true);
        gameObjectReference.vend();
    };

    /*
     *
     * @returns {undefined}
     */
    this.vendReset = function() {

        if (gameObjectReference.quickSell() === false) {

            if (pyoElement !== null) {

                gameImageElement.style.display = "none";
                pyoElement.style.display = "block";
                closeElement.style.display = "none";
            }
            else {

                var index, nodes;

                nodes = mainElement.children;

                for (index = 0; index < nodes.length; index++) {

                    nodes[index].style.display = "block";
                }

                pyoButtonElement.style.display = "none";
            }

            vendingCount = 0;
            resetIdleTimer(true);
        }
    };

     /*
     *
     * @returns {undefined}
     */
    this.vendComplete = function() {

        if (vendingCount <= 0) {

            setTimeout(function () {

                if (closeCallback) {

                    closeCallback("CLOSE");
                }
            }, 750);
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function buttonClickHandler(event) {

        if (event.target.nodeName === "BUTTON") {

            resetIdleTimer(true);

            switch(event.target.value) {

                case "PRESENTER_INFO":

                    if (vendingCount === 0) {

                        mainElement2.style.display = (mainElement2.style.display === "block" ? "none" : "block");
                        resetIdleTimer(true);
                        return stopPropagation(event);
                    }
                    break;

                case "PRESENTER_INFO_CLOSE":

                    mainElement2.style.display = "none";
                    resetIdleTimer(true);
                    return stopPropagation(event);

                case "PRESENTER_SELECTION":

                    if (vendingCount === 0) {

                        // Hide everything but the ticket image
                        showChildren(false);
                        gameImageElement.style.display = "block";

                        resetIdleTimer(true);

                        // Set the state of vending count
                        if (gameObjectReference.game().gameType === GTGUI.GAME_TYPE.ONLINE) {

                            vendingCount = 1;
                        }
                        else {

                            vendingCount = parseInt(event.target.gameData.numberOfTickets);
                        }
                    }

                    break;

                case "PRESENTER_CLOSE":
                    break;

                case "PRESENTER_PICK_YOUR_OWN":

                    // Hide everything
                    showChildren(false);

                    pyoElement = document.createElement("iframe");
                    pyoElement.className = "presenterPYOArea";
                    pyoElement.src = "content/"+pyoHTMLFileName;

                    mainElement.appendChild(pyoElement);
                    break;

                case "":
                    break;
            }
        }
        else if (event.target.className === "presenterInformationArea") {

            mainElement2.style.display = "none";
            return stopPropagation(event);
        }
    }

    /*
     *
     * @param {type} value
     * @returns {undefined}
     */
    var showChildren = function(value) {

        var index, nodes, show;

        show = (value === true ? "block" : "none");

        nodes = mainElement.children;

        for (index = 0; index < nodes.length; index++) {

            nodes[index].style.display = show;
        }

        // This button show never been displayed
        pyoButtonElement.style.display = "none";
        mainElement2.style.display = "none";
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    var pyoEvents = function(event) {

        switch(event.data.message) {

            // Called when onLoad is completed of the PYO
            case "PYO_LOADED":
                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.PRESENTER_EVENT.PRESENTER_EVENT, GTGUI.PRESENTER_EVENT.REQUEST_UPDATE, event));
                break;

            case "PYO_CLICK":
                // use hidden button to get sound events
                pyoButtonElement.click();
                resetIdleTimer(true);
                break;

            case "PYO_CANCEL":
                showChildren(true);
                mainElement.removeChild(pyoElement);
                pyoElement = null;
                event.stopPropagation();
                break;

            case "PYO_HOME":
                closeCallback("CLOSE");
                event.stopPropagation();
                break;

            case "PYO_REQUEST_QP_NUMBERS":
                _self.dispatchEvent(new GTGUI.ObservableEvent(GTGUI.PRESENTER_EVENT.PRESENTER_EVENT, GTGUI.PRESENTER_EVENT.REQUEST_MANUAL_QP_ONLINE, event));
                break;

            case "PYO_REQUEST_PURCHASE":
                showChildren(false);
                gameImageElement.style.display = "block";

                vendingCount = 1;

                gameImageElement.value = "PRESENTER_SELECTION";
                gameImageElement.gameData = event.data;
                gameImageElement.gameData.gameType = GTGUI.GAME_TYPE.ONLINE;
                gameImageElement.gameData.type = "manual";
                gameImageElement.gameData.confirmation = true;
                gameImageElement.gameData.totalCost = parseFloat(event.data.price.substr(3));
				//
                gameImageElement.click();
                gameImageElement.style.pointerEvents = "none";
                break;
        }
    };

    /*
     *
     * @returns {Boolean}
     */
    this.isPYON = function() {

        return (pyoElement !== null);
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    this.resetIdle = function(restart) {

        resetIdleTimer(restart);
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        if (parseInt(GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT) !== 0) {
            
            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (restart) {

                idleTimerID = setTimeout(onIdleTimerTimeout, GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT);
            }
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onIdleTimerTimeout(event) {

        idleTimerID = 0;
        closeCallback("TIMED_OUT");
    };

    /*
     *
     * @returns {unresolved}
     */
    this.getPosition = function() {

        return mainElement.getAttribute("data-position");
    };
};

GTGUI.OneToOne.Presenter.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.OneToOne.Presenter.prototype.constructor = GTGUI.OneToOne.Presenter;

GTGUI.PRESENTER_EVENT = {

    PRESENTER_EVENT: "PRESENTER_EVENT",
    REQUEST_UPDATE: "REQUEST_UPDATE",
    REQUEST_CLICK: "REQUEST_CLICK",
    REQUEST_MANUAL_QP_ONLINE: "REQUEST_MANUAL_QP_ONLINE"
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// PLAYSLIP PRESENTER
// -----------------------------------------------------------------------------
GTGUI.OneToOne.PlayslipPresenter = function() {

    GTGUI.Observable.call(this);

    var _self = this;

    var mainElement = null;
    var gameImageElement = null;
    var textElement = null;
    var idleTimerID = 0;
    var gameObjectReference = null;
    var vendingCount = 0;
    var closeCallback = null;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        if (gameObjectReference !== null) {

            gameObjectReference.clearPresentableImage();
            gameObjectReference = null;
        }

        gameImageElement = null;
        textElement = null;

        closeCallback = null;

        // Remove HTML
        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;
    };

    /*
     *
     * @param {type} gameObject
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} parent
     * @param {type} callback
     * @returns {undefined}
     */
    this.create = function(gameObject, deviceInfo, deviceState, parent, callback) {

        var game, index, nodes, node;

        // Save the close callback reference
        closeCallback = callback;

        // Set the presented element on the game
        gameObjectReference = gameObject;
        game = gameObjectReference.game();

        mainElement = document.createElement("div");
        mainElement.className = "presenterZone";
        mainElement.setAttribute("data-position", "top");

        parent.appendChild(mainElement);

        gameImageElement = gameObjectReference.getPresentableImage(true);
        gameImageElement.style.zIndex = "10";
        mainElement.appendChild(gameImageElement);

        textElement = document.createElement("div");
        textElement.className = "presenterTitle";
        textElement.style.zIndex = "1";

        mainElement.appendChild(textElement);

        nodes = mainElement.children;

        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-game", game.gameId);
            node.setAttribute("data-gametype", game.gameType);
            node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
        }

        vendingCount = 1;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        var text;

        if (gameObjectReference === null) {

            return;
        }

        text = GTGUI.Language.get("PRESENTER_PLAYSLIP_PRESENTED");
        textElement.innerHTML = text;
    };

    /*
     *
     * @returns {undefined}
     */
    this.vend = function() {

        vendingCount--;
        resetIdleTimer(true);
        gameObjectReference.vend();
    };

    /*
     *
     * @returns {undefined}
     */
    this.vendReset = function() {

        if (closeCallback !== undefined) {

            closeCallback("CLOSE");
        }
    };

     /*
     *
     * @returns {undefined}
     */
    this.vendComplete = function() {

        if (closeCallback !== undefined) {
            //gameImageElement.style.pointerEvents = "";
            closeCallback("CLOSE");
        }
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    this.resetIdle = function(restart) {

        resetIdleTimer(restart);
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        if (parseInt(GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT) !== 0) {

            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (restart) {

                idleTimerID = setTimeout(onIdleTimerTimeout, GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT);
            }
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onIdleTimerTimeout(event) {

        idleTimerID = 0;

        if (closeCallback !== undefined) {

            closeCallback("TIMED_OUT");
        }
    };

    /*
     *
     *
     */
    this.getPosition = function() {

        return mainElement.getAttribute("data-position");
    };
};

// Event handling prototyps creation
GTGUI.OneToOne.PlayslipPresenter.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.OneToOne.PlayslipPresenter.prototype.constructor = GTGUI.OneToOne.PlayslipPresenter;

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// SamplerPresenter
// -----------------------------------------------------------------------------
GTGUI.OneToOne.SamplerPresenter = function() {

    GTGUI.Observable.call(this);

    var _self = this;

    var mainElement = null;
    var gameImageElement = null;
    var textElement = null;
    var containerElement = null;
    var closeElement = null;
    var selectedElement = null;
    var idleTimerID = 0;
    var gameObjectReference = null;
    var vendingCount = 0;
    var vendingElement;
    var presented = false;
    var closeCallback = null;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        if (gameObjectReference !== null) {

            gameObjectReference.clearPresentableImage();
            gameObjectReference = null;
        }

        gameImageElement = null;
        textElement = null;
        containerElement = null;
        closeElement = null;
        closeCallback = null;

        // Remove HTML
        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;
    };

    /*
     *
     * @param {type} gameObject
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} parent
     * @param {type} callback
     * @returns {undefined}
     */
    this.create = function(gameObject, deviceInfo, deviceState, parent, callback) {

        var game, index, nodes, node, element, button, price, count, text;
        var row, perRow, samplerWidth, samplerHeight, totalWidth, totalHeight;
        var top, left;

        // Save the close callback reference
        closeCallback = callback;

        // Set the presented element on the game
        gameObjectReference = gameObject;
        game = gameObjectReference.game();

        mainElement = document.createElement("div");
        mainElement.className = "presenterZone";
        mainElement.setAttribute("data-position", (deviceState.flipped ? "bottom" : "top"));
        mainElement.onclick = clickHandler;

        parent.appendChild(mainElement);

        textElement = document.createElement("div");
        textElement.className = "presenterTitle";
        textElement.style.zIndex = "1";

        mainElement.appendChild(textElement);

        containerElement = document.createElement("div");
        containerElement.className = "presenterSamplerContainer";
        containerElement.style.zIndex = "1";

        mainElement.appendChild(containerElement);

        closeElement = document.createElement("button");
        closeElement.className = "presenterCloseButton";
        closeElement.style.zIndex = "2";
        closeElement.value = "PRESENTER_CLOSE";

        mainElement.appendChild(closeElement);

        count = deviceInfo.samplers.length;

        // Create samplers
        for (index = 0; index < count; index++) {

            element = document.createElement("div");
            element.className = "presenterSamplerPlaque presenterSamplerPlaqueNoTransition";
            element.style.zIndex = "1";
            element.style.display = "block";

            mainElement.appendChild(element);

            button = document.createElement("button");
            button.className = "presenterSamplerButton";
            button.value = "PRESENTER_SELECTION_SAMPLER";

            element.appendChild(button);

            text = document.createElement("div");
            text.className = "presenterSamplerButtonText";

            button.appendChild(text);

            price = document.createElement("div");
            price.className = "presenterSamplerButtonPrice";
            price.style.zIndex = "1";

            element.appendChild(price);

            showInformation(deviceInfo, deviceState, index, button, text, price);
        }

        nodes = mainElement.getElementsByTagName("*");

        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-game", game.gameId);
            node.setAttribute("data-gametype", game.gameType);
            node.setAttribute("data-bins", GTGUI.OneToOne.BINS);
        }

        nodes = mainElement.children;

        vendingCount = 1;

        perRow = [1, 2, 3, 4, 3, 3, 4, 4, 5, 5];
        row = 0;

        samplerWidth = nodes[3].offsetWidth;
        samplerHeight = nodes[3].offsetHeight;

        totalWidth = perRow[count - 1] * samplerWidth;
        totalHeight = (count > 4 ? 2 : 1) * samplerHeight;

        containerElement.style.width = totalWidth + 25 + "px";
        containerElement.style.height = totalHeight + 25 + "px";

        left = (mainElement.offsetWidth / 2) - ((totalWidth + 25)  / 2);
        top = (mainElement.offsetHeight / 2) - ((totalHeight + 25)  / 2) + 45;

        containerElement.style.top = top + "px";
        containerElement.style.left = left + "px";

        closeElement.style.top = (containerElement.offsetTop - (closeElement.offsetHeight >> 1)).toString() + 'px';
        closeElement.style.left = (containerElement.offsetLeft - (closeElement.offsetWidth >> 1)).toString() + 'px';

        //Layout the sampler buttons
        left = (mainElement.offsetWidth / 2) - (totalWidth / 2);
        top = (mainElement.offsetHeight / 2) - (totalHeight / 2) + 47.5;

        for (index = 0; index < perRow[count - 1]; index++) {

            element = nodes[index + 3];

            element.style.display = "block";
            element.style.top = (top + "px");
            element.style.left = (left + "px");

            left += samplerWidth;

            element.className = "presenterSamplerPlaque";
        }

        left = (mainElement.offsetWidth / 2) - (((count - perRow[count - 1]) * samplerWidth) / 2);
        top += samplerHeight;

        //Layout the sampler buttons
        for (;index < count; index++) {

            element = nodes[index + 3];

            element.style.display = "block";
            element.style.top = (top + "px");
            element.style.left = (left + "px");

            left += samplerWidth;

            element.className = "presenterSamplerPlaque";
        }

        nodes = mainElement.children;
        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-game", game.gameId);
            node.setAttribute("data-gametype", game.gameType);
            node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function clickHandler(event) {

        var value = event.target.value;

        resetIdleTimer(true);

        if (value !== undefined) {

            switch (value) {

                case "PRESENTER_SELECTION_SAMPLER":
                    present(event.target.parentNode);
                    break;
            }
        }

        // Don't allow non-button clicks to propergate up
        if (event.target.nodeName !== "BUTTON") {

            event.stopPropagation();
            return false;
        }
    };

    /*
     *
     * @param {type} element
     * @returns {undefined}
     */
    function present(element) {

        var top, left, width, height;

        height = element.offsetHeight;
        width = element.offsetWidth;

        top = (mainElement.offsetHeight - height) >> 1;
        left = (mainElement.offsetWidth - width) >> 1;

        // Save for resetting
        selectedElement = element;
        selectedElement.savedTop = element.style.top;
        selectedElement.savedLeft = element.style.left;

        // Listen for the transition end
        element.addEventListener("webkitTransitionEnd", presentTransitionEndHandler(element));

        element.style.top = (top).toString() + "px";
        element.style.left = (left).toString() + "px";
        element.style.width = (width).toString() + "px";
        element.style.height = (height).toString() + "px";

        showChildren(false);
        element.childNodes[1].style.display = "none";
        element.style.pointerEvents = "none";
        element.style.display = "block";
    };

    /*
     *
     * @param {type} element
     * @returns {GTGUI.OneToOne.SamplerPresenter.presentTransitionEndHandler.handler}
     */
    var presentTransitionEndHandler = function(element) {

        var handler = function(event) {

            element.removeEventListener("webkitTransitionEnd", handler);

            presented = true;
            textElement.innerHTML = GTGUI.Language.get("PRESENTER_SAMPLER_CHOSEN");
            textElement.style.display = "block";

            // Set how many tickets are expected
            //CAMCOMEBACK TICKET COUNT
            vendingCount = element.firstChild.gameData.ticketCount;
            vendingElement = element;

            element.firstChild.value = "PRESENTER_SELECTION";
            element.firstChild.noclick = true;
            element.firstChild.click();

            //closeElement.style.top = ((element.offsetTop - 10) - (closeElement.offsetHeight >> 1)).toString() + 'px';
            //closeElement.style.left = ((element.offsetLeft - 10) - (closeElement.offsetWidth >> 1)).toString() + 'px';
            //closeElement.style.display = "block";
        };

        return handler;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} index
     * @param {type} button
     * @param {type} text
     * @param {type} price
     * @returns {undefined}
     */
    function showInformation(deviceInfo, deviceState, index, button, text, price) {

        var parameters, data, buttonText, count, index, games, game;
        var cost, totalCost, boards, onlineGameId, name;

        var ID = 0;
        var BOARDS = 2;
        var COST = 6;

		
		console.log("SAMPLER PARAMETERS: ");
		console.log(deviceInfo.samplers);
		
        parameters = deviceInfo.samplers[index].parameters;
        if(parameters != undefined){
            if(parameters.hasOwnProperty("arrayOfTickets")){
                console.log("ALTURA");
                data = parameters.arrayOfTickets.substr(1, parameters.arrayOfTickets.length - 2);
                games = data.substr(1, data.length - 2).split("], [");

                totalCost = GTGUI.Language.getCurrency(parameters.amount);
                count = parseInt(parameters.numberOfTickets);

                name = parameters.promotionName;
                name.trim();

                while ((index = name.indexOf("  ")) !== -1) {

                    name = name.replace("  ",  " ");

                }

                buttonText = "<h1>" + name + "</h1><br/>";
                //buttonText += "<h2>" + totalCost + " gets you</h2>";
                buttonText += "<table>";

                // Set the game wager information
                button.gameData = {};
                button.gameData.gameId = parameters.gameId;
                button.gameData.totalCost = parseFloat(totalCost.substr(1));
                button.gameData.gameType = GTGUI.GAME_TYPE.ONLINE;
                button.gameData.confirmation = false;
                button.gameData.ticketCount = count;

                for (index = 0; index < count; index++) {

                    game = games[index].split(", ");

                    onlineGameId = game[ID];
                    cost = GTGUI.Language.getCurrency(game[COST]);
                    boards = game[BOARDS];

                    buttonText += "<tr><td id='price'>" + cost + "</td><td>" + boards + " brd " + getGameId(deviceInfo, onlineGameId) + "</td></tr>";

                };

                buttonText += "</table>";

                text.innerHTML = buttonText;
                price.innerHTML = totalCost;
                
                } else if(parameters.hasOwnProperty("ticketDetails")){
                    console.log("NEOS");
                    console.log(parameters);
                    
                    //totalCost = GTGUI.Language.getCurrency(parameters.amount);
                    if(parameters.hasOwnProperty("giftPackPrice")){
                        totalCost = GTGUI.Language.getCurrency(parameters.giftPackPrice);
                    } else {
                        var tempStrIndx = parameters.giftPackName.indexOf("$");
                        var tempStr = parameters.giftPackName.substr(tempStrIndx+1,5);
                        
                        totalCost = GTGUI.Language.getCurrency(parseInt(tempStr));
                    }
                    
                    count = parseInt(parameters.numberOfTickets);
                    
                    name = parameters.giftPackName;
                    buttonText = "<h1>" + name + "</h1><br/>";
                    //buttonText += "<h2>" + totalCost + " gets you</h2>";
                    buttonText += "<table>";

                    // Set the game wager information
                    button.gameData = {};
                    button.gameData.gameId = parameters.gameId;
                    button.gameData.totalCost = parseFloat(totalCost.substr(1));
                    button.gameData.gameType = GTGUI.GAME_TYPE.ONLINE;
                    button.gameData.confirmation = false;
                    button.gameData.ticketCount = count;

                    for (index = 0; index < count; index++) {

                        game = parameters.ticketDetails[index];
    
                        onlineGameId = game.gameId;
                        cost = game.betAmount;
                        boards = game.numberOfBoards;

                        buttonText += "<tr><td id='price'>" + cost + "</td><td>" + boards + " brd " + getGameId(deviceInfo, onlineGameId) + "</td></tr>";
                    };

                    buttonText += "</table>";

                    text.innerHTML = buttonText;
                    price.innerHTML = totalCost;
                }
            }
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} onlineGameId
     * @returns {deviceInfo.onlineGames.gameId|String}
     */
    function getGameId(deviceInfo, onlineGameId) {

        var index, games;

        games = deviceInfo.onlineGames;

        for (index = 0; index < games.length; index++) {

            if (games[index].onlineGameId === onlineGameId) {

                return games[index].gameId;
            }
        }

        return "";
    };

    /*
     *
     * @param {type} value
     * @returns {undefined}
     */
    var showChildren = function(value) {

        var index, nodes, show;

        show = (value === true ? "block" : "none");

        nodes = mainElement.children;

        for (index = 0; index < nodes.length; index++) {

            nodes[index].style.display = show;
        }
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        if (presented !== true) {

            textElement.innerHTML = GTGUI.Language.get("PRESENTER_SAMPLER_SELECT");
        }
        else {

            textElement.innerHTML = GTGUI.Language.get("PRESENTER_SAMPLER_CHOSEN");
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.flip = function() {

        var current = mainElement.getAttribute("data-position");

        if (current === "top") {

            mainElement.setAttribute("data-position", "bottom");
        }
        else {

            mainElement.setAttribute("data-position", "top");
        }
    };

    /*
     *
     * @returns {undefined}
     */
    this.vend = function() {

        vendingCount--;
        resetIdleTimer(true);
        gameObjectReference.vend(null, vendingElement);
    };

    /*
     *
     * @returns {undefined}
     */
    this.vendReset = function() {

        showChildren(true);

        selectedElement.style.top = selectedElement.savedTop;
        selectedElement.style.left = selectedElement.savedLeft;

        selectedElement.childNodes[1].style.display = "block";
        selectedElement.style.pointerEvents = "auto";
        selectedElement.style.display = "block";

        selectedElement.firstChild.value = "PRESENTER_SELECTION_SAMPLER";
    };

    /*
     *
     * @returns {undefined}
     */
    this.vendComplete = function() {

        if (closeCallback !== undefined) {

            closeCallback("CLOSE");
        }
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    this.resetIdle = function(restart) {

        resetIdleTimer(restart);
    };

    /*
     *
     *
     */
    this.getPosition = function() {

        return mainElement.getAttribute("data-position");
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        if (GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT !== 0) {

            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (restart) {

                idleTimerID = setTimeout(onIdleTimerTimeout, GTGUI.OneToOne.IDLE_PRESENTER_TIMEOUT);
            }
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function onIdleTimerTimeout(event) {

        idleTimerID = 0;

        if (closeCallback !== undefined) {

            closeCallback("TIMED_OUT");
        }
    };
};

// Event handling prototyps creation
GTGUI.OneToOne.SamplerPresenter.prototype = Object.create(GTGUI.Observable.prototype);
GTGUI.OneToOne.SamplerPresenter.prototype.constructor = GTGUI.OneToOne.SamplerPresenter;

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// MODAL
// -----------------------------------------------------------------------------
GTGUI.OneToOne.Modal = function() {

    var mainElement = null;
    var frameElement = null;
    var button1Element = null;
    var button2Element = null;
    var headerElement = null;
    var ticketElement = null, textElement = null, textElement2 = null, boardsElement = null, imageElement = null;
    var numberButtonsElement = null;
    var inputElement = null;
    var fullKeypadElement = null;
    var otherButton = null;

    var modalType = 0;
    var returnValue = "";
    var currentMessage = "";
    var idleTimerID = 0;
    var eventData = null;
    var idleTimeout = 0;
    var countDownClock = null;
    var countDownClockID = 0;

    var closeCallback = null;
    var interval = null;

 
                  


    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (idleTimerID !== 0) {

            clearTimeout(idleTimerID);
        }

        if (countDownClockID !==0) {

            clearInterval(countDownClockID);
        }

        frameElement = null;
        button1Element = null;
        button2Element = null;
        headerElement = null;
        eventData = null;
        returnValue = null;

        mainElement.parentNode.removeChild(mainElement);
        mainElement = null;

        closeCallback = null;
        currentMessage = null;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} position
     * @param {type} message
     * @param {type} type
     * @param {type} callback
     * @param {type} data
     * @param {type} timeout
     * @returns {GTGUI.OneToOne.Modal.mainElement}
     */
    this.create = function(deviceInfo, deviceState, position, message, type, callback, data, timeout) {

        var index, nodes, node;

        // Save the current message and the callback
        currentMessage = message;

        closeCallback = callback;
        modalType = type;
        eventData = data;
        idleTimeout = timeout;

        mainElement = document.createElement("div");
        mainElement.className = "modalZone";
        mainElement.style.zIndex = "15";
        mainElement.onclick = clickHandler;

        frameElement = document.createElement("div");
        frameElement.className = "modalFrame";
        frameElement.style.zIndex = "1";

        mainElement.appendChild(frameElement);


        switch (type) {
            // CASHLESS: Quick keypad
            case GTGUI.OneToOne.MODAL_QUICKPAD:

                changeHeadline = document.createElement("h1");
                changeHeadline.className = "changeHeadlinePosition";
                mainElement.appendChild(changeHeadline);

                numberButtonsElement = document.createElement("div"); 
                numberButtonsElement.className = "quickNumberPad";
                mainElement.appendChild(numberButtonsElement);

                
                // CASHLESS
                // Cashless denominations comes in as an array wrapped in a string
                // Code below transforms into array for looping

                var quickValue = deviceInfo.configuration.cashless_denominations;
                var quickValueString = quickValue.substr(1, quickValue.length - 2);
                var quickValueArray = quickValueString.replace(/ /g, '').split(",");
                console.log(quickValueArray);
                
                var arrayLength = quickValueArray.length;
                var quickKeyPadButtons;

                
                for (var i = 0; i < arrayLength; i++) {

                    quickKeyPadButtons = document.createElement("button");
                    quickKeyPadButtons.className = "quickKeyPadStroke";
                    quickKeyPadButtons.value = quickValueArray[i];
                    quickKeyPadButtons.innerHTML = GTGUI.Language.getCurrency(quickValueArray[i]);
                    numberButtonsElement.appendChild(quickKeyPadButtons); 

                }
                
                if (arrayLength >= 4 || arrayLength === 2) {

                    otherButton = document.createElement("button");
                    otherButton.className = "otherButtonFull";
                    otherButton.value = "OTHER";
                    numberButtonsElement.appendChild(otherButton);

                }
                else {

                    otherButton = document.createElement("button");
                    otherButton.className = "otherButton";
                    otherButton.value = "OTHER";
                    numberButtonsElement.appendChild(otherButton);
                    

                }

                button1Element = document.createElement("button");
                button1Element.className = "modalNoButton";
                button1Element.style.zIndex = "2";
                button1Element.value = "CANCEL";

                button2Element = document.createElement("button");
                button2Element.className = "modalYesButton";
                button2Element.style.zIndex = "2";
                button2Element.value = "OKAY";

                numberButtonsElement.appendChild(button1Element);
                numberButtonsElement.appendChild(button2Element);

                break;

                // CASHLESS: Full keypad to create own value
                case GTGUI.OneToOne.MODAL_NUMBERPAD:
             
                fullKeypadElement = document.createElement("div");
                fullKeypadElement.className = "fullModalKeyPad";
                mainElement.appendChild(fullKeypadElement);

                var keypadCreditMaxed = document.createElement("div");
                keypadCreditMaxed.className = "keypadCreditMaxed";
                keypadCreditMaxed.style.display = "none";
                var creditMaxedH1 = document.createElement("h2");
                creditMaxedH1.innerHTML = GTGUI.Language.get("CASHLESS_CREDIT_MAX");
                fullKeypadElement.appendChild(keypadCreditMaxed);
                keypadCreditMaxed.appendChild(creditMaxedH1);

                inputElement = document.createElement("input");
                inputElement.className = "keypadInput";
                inputElement.setAttribute("readonly", true);
                inputElement.type = "text";
                fullKeypadElement.appendChild(inputElement);

                // TODO: Double check button functionality
                var arrow = "<img class=\'backArrow\' src=\'content/backArrow.png\'>";
                var fullKeypadValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, arrow, 0];
                var fullKeyPadButtons;

               
                for (var i = 0; i < fullKeypadValues.length; i++) {

                    fullKeyPadButtons = document.createElement("button");
                    fullKeyPadButtons.className = "fullKeyPadStroke";
                    fullKeyPadButtons.value = fullKeypadValues[i];
                    if (fullKeyPadButtons.value === arrow) {
                        fullKeyPadButtons.value = "backArrow";
                    }
                    fullKeyPadButtons.innerHTML = fullKeypadValues[i];
                    fullKeypadElement.appendChild(fullKeyPadButtons); 
                }


                button3Element = document.createElement("button");
                button3Element.className = "modalNoButton";
                button3Element.style.zIndex = "2";
                button3Element.value = "CANCEL";

                button4Element = document.createElement("button");
                button4Element.className = "modalYesButton";
                button4Element.style.zIndex = "2";
                button4Element.value = "OKAY";

                fullKeypadElement.appendChild(button3Element);
                fullKeypadElement.appendChild(button4Element);
                

                break;

            // CASHLESS Print receipt modal
            case GTGUI.OneToOne.MODAL_PRINT_CASHLESS_RECEIPT:


                button1Element = document.createElement("button");
                button1Element.className = "modalNoButton";
                button1Element.style.zIndex = "2";
                button1Element.value = "NO_RECEIPT";
                

                button2Element = document.createElement("button");
                button2Element.className = "modalYesButton";
                button2Element.style.zIndex = "2";
                button2Element.value = "RECEIPT";

                mainElement.appendChild(button1Element);
                mainElement.appendChild(button2Element);

                break;

            case GTGUI.OneToOne.MODAL_YESNO_PLUS:
            case GTGUI.OneToOne.MODAL_YESNO:
            case GTGUI.OneToOne.MODAL_BETSLIP_CONFIRM:
            case GTGUI.OneToOne.MODAL_REINVEST:

                button1Element = document.createElement("button");
                button1Element.className = "modalNoButton";
                button1Element.style.zIndex = "2";
                button1Element.value = "NO";

                button2Element = document.createElement("button");
                button2Element.className = "modalYesButton";
                button2Element.style.zIndex = "2";
                button2Element.value = "YES";

                mainElement.appendChild(button1Element);
                mainElement.appendChild(button2Element);

                // return what was sent...
                returnValue = eventData;
                break;

            case GTGUI.OneToOne.MODAL_OKAY:

                button1Element = document.createElement("button");
                button1Element.className = "modalOkayButton";
                button1Element.style.zIndex = "2";
                button1Element.value = "OKAY";

                mainElement.appendChild(button1Element);
                break;

            case GTGUI.OneToOne.MODAL_CASHLESS_IDLE:

                function countDown() {
                    var endTime = new Date().getTime();
                    endTime += GTGUI.OneToOne.IDLE_MODAL_TIMEOUT;
                    countDownClockID = setInterval(function () {
                        var currentTime = new Date().getTime();
                        var difference = (endTime - currentTime)/1000;
                        countDownClock.innerHTML = ":" + ('0' + parseInt(difference)).slice(-2);
                        if (currentTime >= endTime) {
                            clearInterval(countDownClockID);
                        }
                        console.log(difference);
                    }, 500);
                }

                button1Element = document.createElement("button");
                countDownClock = document.createElement("h2");
                countDownClock.id = "timerId";
                countDownClock.className = "countDown";
                countDownClock.style.display = "block";
                button1Element.className = "modalOkayButton";
                button1Element.style.zIndex = "2";
                button1Element.value = "OKAY";

                mainElement.appendChild(button1Element);
                mainElement.appendChild(countDownClock);

                countDown();
                break;
        }

        // Set the position on all div elements
        // CASHLESS: Changed data-position to undefined to match wireframe, now modal will show left position when
        // presenter is selected
        mainElement.setAttribute("data-position", "undefined");
        mainElement.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);

        nodes = mainElement.getElementsByTagName("*");

        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-position", position);
            node.setAttribute("data-bins", deviceInfo.configuration.number_of_instant_bins);
        }

        this.update(deviceInfo, deviceState);

        return mainElement;
    };

    /*
     *
     * @returns {undefined}
     */
     

    // CASHLESS: If cashless timeout modal occurs and user clicks off modal, do not reset deviceState
    this.keepState = function() {
        if (modalType === GTGUI.OneToOne.MODAL_CASHLESS_IDLE) {
            return true;
        }
        else {
            return false;
        }
    }; 

    this.close = function() {

        if (closeCallback) {

            closeCallback();
            return true;
        }
        else {

            return false;
        }
    };


    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) { 


        resetIdleTimer(true);
        var cashlessMaxCredit;
        var cashlessSaleAmount;

        // CASHLESS: set deviceState.cashless.actualSales - pass in getCurrency
        cashlessMaxCredit = GTGUI.Language.getCurrency(deviceInfo.configuration.max_credit);

        switch (modalType) {

            case GTGUI.OneToOne.MODAL_OKAY:
                frameElement.innerHTML = GTGUI.Language.get(currentMessage,cashlessSaleAmount);
                button1Element.innerHTML = GTGUI.Language.get("BUTTON_OKAY");
                break;

            
            case GTGUI.OneToOne.MODAL_CASHLESS_IDLE:

                frameElement.innerHTML = GTGUI.Language.get(currentMessage,cashlessSaleAmount);
                button1Element.innerHTML = GTGUI.Language.get("BUTTON_IDLE");
                break;   

            case GTGUI.OneToOne.MODAL_YESNO_PLUS:
                frameElement.innerHTML = '<object class="presenterInformationAreaLoadedObject" type="text/html" data="' + GTGUI.Language.getFile(currentMessage.infoFile) + '" ></object>';
                frameElement[0].setAttribute("data-message", currentMessage);
                button1Element.innerHTML = GTGUI.Language.get("BUTTON_NO");
                button2Element.innerHTML = GTGUI.Language.get("BUTTON_YES");
                break;

            case GTGUI.OneToOne.MODAL_QUICKPAD:
                frameElement.innerHTML = GTGUI.Language.get(currentMessage);
                changeHeadline.innerHTML = GTGUI.Language.get ("CHANGE_MESSAGE");
                button1Element.innerHTML = GTGUI.Language.get ("BUTTON_CANCEL");
                button2Element.innerHTML = GTGUI.Language.get("BUTTON_OKAY");
                otherButton.innerHTML = GTGUI.Language.get("BUTTON_OTHER");
                break;

            case GTGUI.OneToOne.MODAL_NUMBERPAD:
                frameElement.innerHTML = GTGUI.Language.get(currentMessage, cashlessMaxCredit);
                button3Element.innerHTML = GTGUI.Language.get("BUTTON_CANCEL");
                button4Element.innerHTML = GTGUI.Language.get("BUTTON_OKAY");
                break;

            case GTGUI.OneToOne.MODAL_PRINT_CASHLESS_RECEIPT:
                frameElement.innerHTML = GTGUI.Language.get(currentMessage, cashlessSaleAmount);
                button1Element.innerHTML =  GTGUI.Language.get("BUTTON_NO_RECEIPT");
                button2Element.innerHTML = GTGUI.Language.get("BUTTON_PRINT_RECEIPT");
                break;             

            case GTGUI.OneToOne.MODAL_REINVEST:
                frameElement.innerHTML = currentMessage;
                button1Element.innerHTML = GTGUI.Language.get("BUTTON_NO");
                button2Element.innerHTML = GTGUI.Language.get("BUTTON_YES");
                break;

            case GTGUI.OneToOne.MODAL_BETSLIP_CONFIRM:
                renderBetslipData(deviceInfo);

            case GTGUI.OneToOne.MODAL_YESNO:
                frameElement.innerHTML = GTGUI.Language.get(currentMessage);
                button1Element.innerHTML = GTGUI.Language.get("BUTTON_NO");
                button2Element.innerHTML = GTGUI.Language.get("BUTTON_YES");
                break;
        }
    };

    /*
     *
     * @param {type} deviceInfo
     * @returns {undefined}
     */
    function renderBetslipData(deviceInfo) {

        var extraText = "", activeGame = "";
        var POWERBALL1 = null, POWERBALL2 = null;
        var nodes = mainElement.getElementsByClassName("ticketLayout");

        var gameData = eventData;

        console.log("Render Betslip - Game Data:")
        console.log(gameData);

        // we must check for this since update calls us more than once !!!
        if (!nodes.length) {
            // Stop document events that cause highlight/drags
            document.body.ondblclick = function (event) {
                event.stopPropagation();
                return false;
            };

            document.body.onmousedown = function (event) {
                event.stopPropagation();
                return false;
            };

            // create ticket element
            ticketElement = document.createElement("div");
            ticketElement.className = "ticketLayout";
            mainElement.appendChild(ticketElement);

            // create image element
            imageElement = document.createElement("div");
            imageElement.className = "ticketLogo";

            // add the image element
            ticketElement.appendChild(imageElement);

            // create boards element
            boardsElement = document.createElement("div");
            boardsElement.className = "ticketBoards";
            ticketElement.appendChild(boardsElement);

            // create text element to display boards, draws, powerplay
            textElement = document.createElement("div");
            textElement.className = "ticketText";
            ticketElement.appendChild(textElement);

            // create text element2 to display price larger
            textElement2 = document.createElement("div");
            textElement2.className = "ticketTextLarge";
            ticketElement.appendChild(textElement2);
        }

        // find the correct logo image for this game
        for (var i = 0; i < deviceInfo.onlineGames.length; i++) {
            // save off these two indices for use later
            if (deviceInfo.onlineGames[i].onlineGameId === "Powerball1") {

                POWERBALL1 = i;
            }
            else if (deviceInfo.onlineGames[i].onlineGameId === "Powerball2") {

                POWERBALL2 = i;
            }

            // see if we have the game we need and set image background url
            if (gameData.gameId === deviceInfo.onlineGames[i].onlineGameId) {

                imageElement.setAttribute("data-game", deviceInfo.onlineGames[i].onlineGameId);
                activeGame = deviceInfo.onlineGames[i].onlineGameId;
            }
        }

        var value1, value2, value3, number, numbers, boards, betTypes, betAmounts, boardString, textString;

        // display the information
        value1 = gameData.numberOfDraws;
        value2 = gameData.numberOfBoards;
        value3 = gameData.betAmount.substr(1, gameData.betAmount.length - 2);

        if (activeGame === "Keno1")
        {
            boards = ["--","--","--","--","--","--","--","--","--","--"];
            for( i=0; i<gameData.boardData.length; i++ )
                boards[i] = gameData.boardData[i];
            value2 = gameData.numberOfSpots;
            var kenoString
            kenoString = "<div id='pyoKenoContainer'>";
            kenoString += "<div class='pyoKenoSpotsContainer'>";
            for(var ki = 0; ki<value2; ki++){
                if(ki<9){
                    if(Number(boards[ki])<10){
                        kenoString += "<div class='pyoKenoSpot'><div class='pyoKenoTextLabel'>0"+(ki+1)+"</div><div class='pyoKenoTextSpot'>0"+boards[ki]+"</div>"+"</div>";
                    } else {
                        kenoString += "<div class='pyoKenoSpot'><div class='pyoKenoTextLabel'>0"+(ki+1)+"</div><div class='pyoKenoTextSpot'>"+boards[ki]+"</div>"+"</div>";
                    }
                    
                } else {
                    if(Number(boards[ki])<10){
                        kenoString += "<div class='pyoKenoSpot'><div class='pyoKenoTextLabel'>"+(ki+1)+"</div><div class='pyoKenoTextSpot'>0"+boards[ki]+"</div>"+"</div>";
                    } else {
                        kenoString += "<div class='pyoKenoSpot'><div class='pyoKenoTextLabel'>"+(ki+1)+"</div><div class='pyoKenoTextSpot'>"+boards[ki]+"</div>"+"</div>";
                    }
                }
                
                if(ki==4){
                    kenoString += "</div>";
                    kenoString += "<div class='pyoKenoSpotsContainer'>";
                }
            }
            
            kenoString += "</div>";
            kenoString += "</div>";
            
            boardsElement.innerHTML = kenoString;
            
            boardString = "<br><br>" + GTGUI.Language.get("MESSAGE_DRAWS") + value1 + "<br>";
            boardString += GTGUI.Language.get("MESSAGE_SPOTS") + value2 + "<br>";
            boardString += GTGUI.Language.get("MESSAGE_BETAMOUNT") + GTGUI.Language.getCurrency(value3) + "<br>";
            textElement.innerHTML = boardString;

            textString = GTGUI.Language.get("MESSAGE_TOTALPRICE") + GTGUI.Language.getCurrency(gameData.price) + "<br>";
            textElement2.innerHTML = textString;
        }
        else
        {
            // break apart the boards
            boards = gameData.boardData.split(",");

            if (gameData.hasOwnProperty("betGroup") && gameData.betGroup !== undefined) {

                if (gameData.betGroup[0] === "[") {

                    betTypes = gameData.betGroup.substr(1, (gameData.betGroup.length - 2)).split(",");
                }
                else {

                    betTypes = gameData.betGroup.split(",");
                }
            } else {
                if (gameData.hasOwnProperty("betType") && gameData.betType !== undefined) {

                    if (gameData.betType[0] === "[") {

                        betTypes = gameData.betType.substr(1, (gameData.betType.length - 2)).split(",");
                    }
                    else {

                        betTypes = gameData.betType.split(",");
                    }
                }
            }

            if (gameData.hasOwnProperty("betAmount") && gameData.betAmount !== undefined) {

                if (gameData.betAmount[0] === "[") {

                    betAmounts = gameData.betAmount.substr(1, (gameData.betAmount.length - 2)).split(",");
                }
                else {

                    betAmounts = gameData.betAmount.split(",");
                }
            }

            // build a table
            boardString = "<table class='ticketBoardList'>";

            var len2;
            for (var index = 0, len = gameData.numberOfBoards; index < len; index++) {
                numbers = boards[index].trim().split(" ");

                boardString += "<tr><td>" + (index + 1) + ")</td>";

                if (gameData.gameId === deviceInfo.onlineGames[POWERBALL1].onlineGameId ||
                    gameData.gameId === deviceInfo.onlineGames[POWERBALL2].onlineGameId)
                    len2 = numbers.length - 1;
                else len2 = numbers.length;

                for (var index2 = 0; index2 < len2; index2++) {
                    number = numbers[index2];
                    if (activeGame !== "Numbers1" && activeGame !== "Numbers2")
                        number = (number < 10 ) ? "0" + number : number;
                    boardString += "<td>" + number + "</td>";
                }
                numbers[index2] = (numbers[index2] < 10 ) ? "0" + numbers[index2] : numbers[index2];

                // DO WE HAVE AN EXTRA NUMBERS GAME ?
                if (gameData.gameId === deviceInfo.onlineGames[POWERBALL1].onlineGameId)
                    boardString += "<td>PB</td><td>" + numbers[index2] + "</td></tr>";
                else if (gameData.gameId === deviceInfo.onlineGames[POWERBALL2].onlineGameId)
                    boardString += "<td>MB</td><td>" + numbers[index2] + "</td></tr>";

                // or do we have a bet type and bet amount for numbers games?
                if (activeGame === "Numbers1" || activeGame === "Numbers2") {
                    boardString += "<td>" + (betTypes[index]).toUpperCase() + "</td>";
                    var ba = "$" + parseFloat(betAmounts[index].substr(3));
                    if( ba.indexOf(".") === -1 )
                        ba += ".00";
                    else ba += "0";
                    boardString += "<td>" + ba + "</td></tr>";
                }
            }

            boardString += "</table>";

            // display draws and boards
            textString = GTGUI.Language.get("MESSAGE_DRAWS") + value1 + "<br>";
            textString += GTGUI.Language.get("MESSAGE_BOARDS") + value2 + "<br>";

            // check to see which extra name to use if needed at all
            if (activeGame === deviceInfo.onlineGames[POWERBALL1].onlineGameId) {

                extraText = GTGUI.Language.get("MESSAGE_POWERPLAY") + ((gameData.powerPlay === true ) ? GTGUI.Language.get("BUTTON_YES") : GTGUI.Language.get("BUTTON_NO"));
            }
            else if (activeGame === deviceInfo.onlineGames[POWERBALL2].onlineGameId) {

                extraText = GTGUI.Language.get("MESSAGE_MEGAPLIER") + ((gameData.powerPlay === true ) ? GTGUI.Language.get("BUTTON_YES") : GTGUI.Language.get("BUTTON_NO"));
            }
            else if (activeGame === "Numbers1" || activeGame === "Numbers2") {

                extraText = GTGUI.Language.get("MESSAGE_DOUBLETAKE") + ((gameData.addOn === true ) ? GTGUI.Language.get("BUTTON_YES") : GTGUI.Language.get("BUTTON_NO"));
            } else {
                extraText = GTGUI.Language.get("MESSAGE_ADDON") + ((gameData.addOn === true ) ? GTGUI.Language.get("BUTTON_YES") : GTGUI.Language.get("BUTTON_NO"));
            }

            // display the draws, boards and (powerplay or megaplier or doubletake) if extra boards are present or numbers games
            textString += extraText;
            textElement.innerHTML = textString;

            // display the total price data
            textString = GTGUI.Language.get("MESSAGE_TOTALPRICE") + "$" + gameData.price.substring(3) + "<br>";
            textElement2.innerHTML = textString;

            boardsElement.innerHTML = boardString;
        }
    };

    /*
     *
     * @param {type} event
     * @returns {undefined}
     */
    function clickHandler(event) {

        var value = event.target.value;

        resetIdleTimer(true);

        if (value !== undefined) {

            switch (value) {

                case "YES":
                case "NO":
                case "OKAY":
                case "CANCEL":
                case "RECEIPT":
                case "NO_RECEIPT":

                    if (closeCallback !== undefined) {

                        closeCallback(value, returnValue);
                    }
                    return;

                // CASHLESS: HTML entity left arrow on 
                case "backArrow":
                    returnValue = returnValue.substr(0, returnValue.length - 1);
                    break;


                default:
                    returnValue += value;
                    break;    
            }

            // CASHLESS: Full keypad button values added to input
            if (fullKeypadElement) {
                fullKeypadElement.querySelector(".keypadInput").value = returnValue;
              
            }

            // CASHLESS: Quick keypad values only returned once
            var quickKeyStroke = document.querySelector(".quickKeyPadStroke");
            if (quickKeyStroke) {
                for(var i = 0; i<document.getElementsByClassName("quickKeyPadStrokeSelected").length; i++){
                    document.getElementsByClassName("quickKeyPadStrokeSelected")[i].classList.remove("quickKeyPadStrokeSelected");
                }
                event.target.classList.add("quickKeyPadStrokeSelected");
                returnValue = value;
            }
        }

        // Don't allow non-button clicks to propergate up
        if (event.target.nodeName !== "BUTTON") {

            event.stopPropagation();
            return false;
        }
    };

    /*
     * @returns {undefined}
     */
    this.flip = function() {

        var current = mainElement.getAttribute("data-position");

        if (current === "top") {

            mainElement.setAttribute("data-position", "bottom");
        }
        else if (current === "bottom") {

            mainElement.setAttribute("data-position", "top");
        }
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    this.resetIdle = function(restart) {

        resetIdleTimer(restart);
    };

    /*
     *
     * @param {type} restart
     * @returns {undefined}
     */
    function resetIdleTimer(restart) {

        var value = 0;

        // Passed in timeout value overrides global value
        if (idleTimeout !== undefined) {

            value = idleTimeout;
        }
        else {

            value = GTGUI.OneToOne.IDLE_MODAL_TIMEOUT;
        }

        if (parseInt(value) !== 0)
        {
            if (idleTimerID !== 0) {

                clearTimeout(idleTimerID);
                idleTimerID = 0;
            }

            if (restart) {

                idleTimerID = setTimeout(onIdleTimerTimeout, value);
            }
        }
    };

    /*
     *
     * @returns {undefined}
     */
    function onIdleTimerTimeout() {

        idleTimerID = 0;
        closeCallback("TIMEOUT");
    };
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// MODAL TYPES
// -----------------------------------------------------------------------------
GTGUI.OneToOne.MODAL_OKAY = "MODAL_OKAY";
GTGUI.OneToOne.MODAL_YESNO = "MODAL_YESNO";
GTGUI.OneToOne.MODAL_YESNO_PLUS = "MODAL_YESNO_PLUS";
GTGUI.OneToOne.MODAL_BETSLIP = "MODAL_BETSLIP";
GTGUI.OneToOne.MODAL_REINVEST = "MODAL_REINVEST";
GTGUI.OneToOne.MODAL_BETSLIP_CONFIRM = "MODAL_BETSLIP_CONFIRM";
GTGUI.OneToOne.MODAL_NUMBERPAD = "MODAL_NUMBERPAD";
GTGUI.OneToOne.MODAL_QUICKPAD = "MODAL_QUICKPAD";
GTGUI.OneToOne.MODAL_PRINT_CASHLESS_RECEIPT = "MODAL_PRINT_CASHLESS_RECEIPT";
GTGUI.OneToOne.MODAL_CASHLESS_IDLE = "MODAL_CASHLESS_IDLE";

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// GAME BASE
// -----------------------------------------------------------------------------
GTGUI.OneToOne.Game = function() {

    var mainElement = null;
    var imageElement = null;
    var priceElement = null;
    var noticeElement = null;
    var presentedElement = null;
    var newElement = null;
    var countElement = null;
    var countElementText = null;
    var mutationObserver = null;
    var gameOptions = null;
    var gameReference = null;

    var quickSell = false;
    var animating = false;
    var direction = 1;
    var invalidGame = false;

    /*
     *
     * @returns {undefined}
     */
    this.remove = function() {

        if (mutationObserver !== null) {

            mutationObserver.disconnect();
            mutationObserver = null;
        }

        imageElement = null;
        priceElement = null;
        noticeElement = null;
        presentedElement = null;
        newElement = null;
        countElement = null;
        countElementText = null;
        inputElement = null;
        numberButtonsElement = null;
        fullKeypadElement = null;

        gameOptions = null;
        gameReference = null;

        if (mainElement.parentNode !== null) {

            mainElement.parentNode.removeChild(mainElement);
        }

        mainElement = null;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @param {type} game
     * @param {type} gameIndex
     * @returns {GTGUI.OneToOne.Game.mainElement}
     */
    this.create = function(deviceInfo, deviceState, game, gameIndex) {

        var newGame, element, node, nodes, index, bins;

        // Save reference to game
        gameReference = game;

        // Get the game options or the default options
        gameOptions = getGameData(gameReference.gameId);

        if (gameOptions === null) {

            gameOptions = getGameData(gameReference.gameType);
            invalidGame = true;
        }

        newGame = (gameOptions.info.newGame !== undefined ? gameOptions.info.newGame : "false");

        mainElement = document.createElement("div");
        mainElement.className = "gameArea";
        mainElement.style.zIndex = (50 - gameIndex).toString();
        mainElement.style.display = "none";

        element = document.createElement("div");
        element.className = "gameAreaPlaque";

        mainElement.appendChild(element);

        element = document.createElement("div");
        element.className = "gameAreaContainer";
        element.style.zIndex = "1";

        mainElement.firstChild.appendChild(element);

        imageElement = document.createElement("button");
        imageElement.className = "gameAreaImage";
        imageElement.style.zIndex = "2";
        imageElement.value = "GAME";
        imageElement.name = gameIndex;

        element.appendChild(imageElement);

        priceElement = document.createElement("div");
        priceElement.className = "gameAreaPriceDisplay";
        priceElement.style.zIndex = "3";

        element.appendChild(priceElement);

        noticeElement = document.createElement("div");
        noticeElement.className = "gameAreaNoticeDisplay";
        noticeElement.style.zIndex = "3";

        element.appendChild(noticeElement);

        countElement = document.createElement("div");
        countElement.className = "gameAreaCountDisplay";
        countElement.style.zIndex = "4";

        element.appendChild(countElement);

        countElementText = document.createElement("div");
        countElementText.className = "gameAreaCountDisplayText";

        countElement.appendChild(countElementText);

        if (newGame === "true") {

            newElement = document.createElement("div");
            newElement.className = "gameAreaNewDisplay";
            newElement.style.zIndex = "4";
            newElement.style.webkitTransform = "rotate(0deg)";
            newElement.addEventListener("webkitTransitionEnd", newTransitionEndHandler);

            element.appendChild(newElement);

            newTransitionEndHandler();

            // Cause a flush of all styles
            window.getComputedStyle(element).opacity;
        }

        bins = deviceInfo.configuration.number_of_instant_bins;

        mainElement.setAttribute("data-game", gameReference.gameId);
        mainElement.setAttribute("data-gametype", gameReference.gameType);
        mainElement.setAttribute("data-new", newGame);
        mainElement.setAttribute("data-bins", bins);

        nodes = mainElement.getElementsByTagName("*");

        for (index = 0; index < nodes.length; index++) {

            node = nodes[index];
            node.setAttribute("data-game", gameReference.gameId);
            node.setAttribute("data-gametype", gameReference.gameType);
            node.setAttribute("data-new", newGame );
            node.setAttribute("data-bins", bins);
        }

        // Online game information does not contain ticket prices it is set
        // in the options... so add it
        if (gameReference.gameType === GTGUI.GAME_TYPE.ONLINE) {

            gameReference.ticketPrice = gameOptions.info.ticketPrice;
        }

        if (gameOptions.gameButtonImage !== undefined && gameOptions.gameButtonImage !== "") {

            if (gameOptions.gameButtonImage.search(".html") === -1) {

                imageElement.style.backgroundImage = GTGUI.Language.getFileUrl(gameOptions.gameButtonImage);
            }
            else {

                imageElement.innerHTML='<object class="gameAreaImageLoadedObject" type="text/html" data="' + GTGUI.Language.getFile(gameOptions.gameButtonImage) + '" ></object>';
            }
        }

        if (gameOptions.priceDisplayColor !== undefined && gameOptions.priceDisplayColor !== "") {

            priceElement.style.backgroundColor = gameOptions.priceDisplayColor;
        }

        return mainElement;
    };

    /*
     *
     * @param {type} game
     * @returns {Array|Object}
     */
    function getGameData(game) {

        if (game !== undefined) {

            var url = "data/" + game + ".json";

            var request = new XMLHttpRequest();
            request.open('get', url, false);
            request.send();

            if (request.status === 200) {

                var jsonData;

                try {

                    jsonData = JSON.parse(request.response);
                    return jsonData;
                }
                catch(e){

                    console.log("Game " + game + ": failed to load:" + e);
                }
            }
        }

        return null;
    };

    /*
     *
     * @param {type} deviceInfo
     * @param {type} deviceState
     * @returns {undefined}
     */
    this.update = function(deviceInfo, deviceState) {

        var gameId, binStatus, gameState = "", noticeText = "";
        var nodes, index, hasParameters;

        gameId = gameReference.gameId

        if (gameReference.gameType === GTGUI.GAME_TYPE.INSTANT) {

            binStatus = gameReference.binStatus;

            if (invalidGame === true) {

                gameState = "error";
                noticeText = "INVALID";
            }
            else if (binStatus.noError || binStatus.inventoryLow && !binStatus.disabled) {

                gameState = "playable";
            }
            else if (binStatus.disabled) {

                if (gameId === 0 ||
                    binStatus.binNotConfigured) {

                    gameState = "disabled";
                    noticeText = "";
                }
                else if (binStatus.inventoryNotAvailable) {

                    gameState = "empty";
                    noticeText = "SOLD_OUT";
                }
                else if (binStatus.jammedTicket ||
                    binStatus.jammedCutter ||
                    binStatus.badEncoderOutput ||
                    binStatus.noTicket ||
                    binStatus.exitSensorBlocked ||
                    binStatus.cutterNotAtHome) {

                    gameState = "error";
                    noticeText = "ERROR";
                }
                else {

                    gameState = "disabled";
                    noticeText = "";
                }
            }
            else {

                gameState = "disabled";
                noticeText = "";
            }

            if (gameOptions.info.newGame === "true" ) {

                if (deviceState.gameObjectPresented === null && deviceState.modalShowing === false && deviceInfo.deviceStatus === "enabled" &&
                    deviceState.idle === false && deviceState.flipping === false && deviceState.help === false) {

                    // If the newElement is not updated in the dom, watch changes.
                    if (newElement.offsetParent === null) {

                        mutationObserver = new MutationObserver(function(mutations) {

                            mutations.forEach(function(mutation) {

                                if (mutation.type === "attributes") {

                                    mutationObserver.disconnect();
                                    mutationObserver = null;

                                    if (animating === false) {

                                        animating = true;
                                        newElement.classList.remove("gameAreaNewDisplayNoAnimation");
                                        newTransitionEndHandler();
                                    }
                                }
                            });
                        });

                        var config = { attributes: true, childList: true, characterData: true };

                        mutationObserver.observe(newElement, config);
                    }
                    else if (animating === false) {

                        animating = true;
                        newElement.classList.remove("gameAreaNewDisplayNoAnimation");
                        newTransitionEndHandler();
                    }
                }
                else {

                    if (animating === true) {

                        newElement.classList.add("gameAreaNewDisplayNoAnimation");
                        animating = false;
                    }
                }
            }

            if (gameReference.currentInventory !== 0 &&  gameReference.currentInventory <= gameOptions.info.lowTicketCount) {

                countElement.setAttribute("data-count", "true");
                countElementText.innerHTML = gameReference.currentInventory;
            }
            else {

                countElement.setAttribute("data-count", "false");
            }
        }
        else {

            if (deviceInfo.printerStatus === "noError" || deviceInfo.printerStatus === "paperLow") {

                if ((GTGUI.OneToOne.REQUIRE_GAME_PARAMETERS === "true" && gameReference.hasOwnProperty("parameters")) || GTGUI.OneToOne.REQUIRE_GAME_PARAMETERS === "false") {

                    hasParameters = true;
                }
                else {

                    hasParameters = false;
                }

                if ((gameReference.currentInventory === 1 && hasParameters === true) || gameReference.gameId === "Sampler") {

                    gameState = "playable";
                }
                else {

                    gameState = "disabled";
                    noticeText = "";
                }
            }
            else
            {
                gameState = "error";
                noticeText = "";
            }
        }

        // Set the state of the game
        nodes = mainElement.getElementsByTagName("*");

        for (index = 0; index < nodes.length; index++) {

            nodes[index].setAttribute("data-state", gameState);
        }

        priceElement.innerHTML = GTGUI.Language.getCurrency(gameReference.ticketPrice, false);
        noticeElement.innerHTML = GTGUI.Language.get(noticeText);
    };

    /*
     *
     * @returns {GTGUI.OneToOne.Game.transitionEnd.handler}
     */
    var newTransitionEndHandler = function() {

        if (animating === true) {

            var angle = 45 * direction;//Math.floor((Math.random() * 36) + 10) * direction;

            window.getComputedStyle(newElement).webkitTransform;
            newElement.style.webkitTransform = "rotate(" + angle + "deg)";
            newElement.style.webkitTransitionDuration = (Math.random() * (1250 - 750) + 750) + 'ms';
            direction = (direction === 1 ? -1 : 1);
        }
    };

    /*
     *
     *
     * @param {type} callback
     * @returns {undefined}
     */
    this.present = function(callback) {

        var top, left, width, height, index, element, elements, image = null, size;

        if (gameOptions.gamePresentedImage !== undefined && gameOptions.gamePresentedImage !== "") {

            image = GTGUI.Language.getFileUrl(gameOptions.gamePresentedImage);
        }

        if (gameOptions.gamePresentedImageSize !== undefined && gameOptions.gamePresentedImageSize !== "") {

            size = gameOptions.gamePresentedImageSize.split("x");

            width = .75 * parseInt(size[0]);
            height = .75 * parseInt(size[1]);
        }
        else {

            height = 261;
            width = 261;
        }

        top = ((666 - height) >> 1) - 30;
        left = (1080 - width) >> 1;

        // Set the state of the game
        presentedElement.setAttribute("data-presented", "true");
        elements = presentedElement.getElementsByTagName("*");

        for (index = 0; index < elements.length; index++) {

            elements[index].setAttribute("data-presented", "true");
        }

        presentedElement.style.backgroundImage = image;

        // Listen for the transition end
        presentedElement.addEventListener("webkitTransitionEnd", presentTransitionEndHandler(callback));
        presentedElement.offsetHeight;

        presentedElement.style.top = (top).toString() + "px";
        presentedElement.style.left = (left).toString() + "px";
        presentedElement.style.width = (width).toString() + "px";
        presentedElement.style.height = (height).toString() + "px";
    };

    /*
     *
     * @param {type} callback
     * @returns {GTGUI.OneToOne.Game.transitionEnd.handler}
     */
    var presentTransitionEndHandler = function(callback) {

        var handler = function(event) {

            presentedElement.removeEventListener("webkitTransitionEnd", handler);
            callback();
        };

        return handler;
    };

    /*
     *
     * @param {type} callback
     * @returns {undefined}
     */
    this.vend = function(callback, element) {

        var angle = Math.floor((Math.random() * 90) + 1) - 45;
        var width, height, acrect, dropTime, vendElement;

        vendElement = document.createElement("div");
        vendElement.style.zIndex = "1";
        vendElement.setAttribute("data-game", gameReference.gameId);

        if (gameOptions.vendImage !== undefined) {

            vendElement.style.backgroundImage = GTGUI.Language.getFileUrl(gameOptions.vendImage);

            if (gameOptions.gamePresentedImageSize !== undefined && gameOptions.gamePresentedImageSize !== "") {

                size = gameOptions.gamePresentedImageSize.split("x");

                width = .75 * parseInt(size[0]);
                height = .75 * parseInt(size[1]);

                vendElement.style.width = width + "px";
                vendElement.style.height = height + "px";

                // Force a reflow so the above changes take effect
                vendElement.offsetHeight;
            }
        }

        if (element !== undefined && element !== null) {

            width = element.offsetWidth;
            rect = element.getBoundingClientRect();

            element.parentNode.appendChild(vendElement);            

            vendElement.style.top = (element.offsetTop + (width >> 1)).toString() + "px";
            vendElement.style.left = (element.offsetLeft + ((width - vendElement.offsetWidth) >> 1)).toString() + "px";

            // Force a reflow so the above changes take effect
            vendElement.offsetHeight;

            vendElement.addEventListener("webkitTransitionEnd", vendTransitionEndHandler(callback, vendElement));

            // Enable the vend transitions again
            vendElement.className = "gameAreaVendImage";
        }
        else if (presentedElement.className === "gameAreaPlayslipImage") {

            rect = presentedElement.getBoundingClientRect();
            vendElement.className = "gameAreaPlayslipVendImage";

            presentedElement.parentNode.appendChild(vendElement);

            // Force a reflow so the above changes take effect
            vendElement.offsetHeight;

            vendElement.addEventListener("webkitTransitionEnd", vendTransitionEndHandler(callback, vendElement));
        }
        else {

            width = presentedElement.offsetWidth;
            rect = presentedElement.getBoundingClientRect();

            presentedElement.parentNode.appendChild(vendElement);

            // prior to setting the orginal position, disable the vend transistions
            vendElement.className = "gameAreaVendImage gameAreaVendImageNoTransition";

            vendElement.style.top = (presentedElement.offsetTop + (width >> 1)).toString() + "px";
            vendElement.style.left = (presentedElement.offsetLeft + ((width - vendElement.offsetWidth) >> 1)).toString() + "px";

            // Force a reflow so the above changes take effect
            vendElement.offsetHeight;

            vendElement.addEventListener("webkitTransitionEnd", vendTransitionEndHandler(callback, vendElement));

            // Enable the vend transitions again
            vendElement.className = "gameAreaVendImage";
        }

        // For online games, sent the ticket to the corner where the printer is
        if (gameReference.gameType === GTGUI.GAME_TYPE.ONLINE) {

            vendElement.style.left = "1080px";
        }

        dropTime = ((1920 - rect.top) / 1920) * 10000;
        vendElement.style.webkitTransitionDuration = dropTime + "ms";

        vendElement.style.top = "1920px";
        vendElement.style.webkitTransform = "rotate(" + angle + "deg)";
    };

    /*
     *
     * @param {type} callback
     * @param {type} vendElement
     * @returns {GTGUI.OneToOne.Game.vendTransitionEndHandler.handler}
     */
    var vendTransitionEndHandler = function(callback, vendElement) {

        var handler = function(event) {

            vendElement.removeEventListener("webkitTransitionEnd", handler);
            vendElement.parentNode.removeChild(vendElement);

            if (callback !== undefined && callback !== null) {

                callback();
            }
        };

        return handler;
    };

    /*
     *
     * @returns {GTGUI.OneToOne.Game.mainElement}
     */
    this.element = function() {

        return mainElement;
    };

    /*
     *
     * @param {type} top
     * @param {type} left
     * @param {type} width
     * @param {type} height
     * @returns {undefined}
     */
    this.position = function(top, left, width, height) {

        if (top !== undefined) {

            mainElement.style.top = (top).toString() + "px";
        }

        if (left !== undefined) {

            mainElement.style.left = (left).toString() + "px";
        }

        if (width !== undefined) {

            mainElement.style.width = (width).toString() + "px";
        }

        if (height !== undefined) {

            mainElement.style.height = (height).toString() + "px";
        }
    };

    /*
     *
     * @returns {unresolved}
     */
    this.getPosition = function() {

        return mainElement.getBoundingClientRect();
    };

    /*
     *
     * @param {type} bool
     * @returns {undefined}
     */
    this.show = function(bool) {

        mainElement.style.display = ((bool === true) ? "block" : "none");
    };

    /*
     *
     * @param {type} playslip
     * @returns {GTGUI.OneToOne.Game.presentedElement}
     */
    this.getPresentableImage = function(playslip) {

        if (presentedElement) {

            presentedElement.parentNode.removeChild(presentedElement);
            presentedElement = null;
        }

        if (playslip === undefined || playslip === false) {

            presentedElement = imageElement.cloneNode(true);
        }
        else {

            presentedElement = document.createElement("div");
            presentedElement.className = "gameAreaPlayslipImage";
            presentedElement.style.zIndex = "10";

            if (gameOptions.playslipImage !== undefined) {

                presentedElement.style.backgroundImage = GTGUI.Language.getFileUrl(gameOptions.playslipImage);
            }
        }

        return presentedElement;
    };

    /*
     *
     * @returns {undefined}
     */
    this.clearPresentableImage = function() {

        if (presentedElement) {

            presentedElement.style.webkitAnimationPlayState = "paused";
            presentedElement.style.webkitTransition = "none";
            presentedElement.parentNode.removeChild(presentedElement);
            presentedElement = null;
        }
    };

    /*
     *
     * @returns {GTGUI.OneToOne.Game.getImagePosition.rect}
     */
    this.getImagePosition = function() {

        var rect = {};
        var presenterPosition = document.getElementsByClassName("presenterZone")[0].getBoundingClientRect();
        var position = imageElement.getBoundingClientRect();

        rect.top = position.top - presenterPosition.top;
        rect.left = position.left - presenterPosition.left;
        rect.width = position.width;
        rect.height = position.height;

        return rect;
    };

    /*
     *
     * @returns {Arguments|GTGUI.OneToOne.Game.quickSell}
     */
    this.quickSell = function() {

        if (arguments[0] !== undefined) {

            quickSell = arguments[0];
        }

        return quickSell;
    };

    /*
     *
     * @returns {GTGUI@call;ObjectCopy.maxCost|gameReference.maxCost|Number|gameOptions.numberOfTickets|GTGUI.OneToOne.Game.maxCost.ticketCost}
     */
    this.maxCost = function() {

        var ticketCost;

        if (gameReference.maxPrice === undefined) {

            return 0;
        }

        if (gameReference.gameType === GTGUI.GAME_TYPE.INSTANT) {

            ticketCost = parseFloat(gameReference.ticketPrice.substr(3));
            return (ticketCost * gameOptions.numberOfTickets[gameOptions.options.length - 1]);
        }
        else {

            return gameReference.maxCost;
        }
    };

    /*
     *
     * @returns {GTGUI.ObjectCopy.obj|GTGUI.OneToOne.Game.gameReference}
     */
    this.game = function() {

        return gameReference;
    };

    /*
     *
     * @returns {GTGUI.OneToOne.Game.gameOptions}
     */
    this.gameOptions = function() {

        return gameOptions;
    };
};

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// LANGUAGE
// -----------------------------------------------------------------------------
GTGUI.Language = function()
{

    var languages = {
        en : {

            AVAILABLE_CREDIT : "Available Credits:",
            ERROR : "ERROR",
            INVALID : "NOT VALID",
            SOLD_OUT : "SOLD OUT",
            FLIP : "Flip Screen",
            CASHLESS: "Pay with Debit Card or Mobile",
            CASHLESS_CANCEL: "Cancel Load Credits",
            CASHLESS_CREDIT_MAX: "Amount too high",
            CASHLESS_MESSAGE: "To use cash instead, press CANCEL on the card entry device",
            HELP : "Help",
            LANGUAGE : "Français",
            PLAY : "Play",
            PLAYS : "Plays",
            SPOT : "Spot",
            SPOTS : "Spots",
            BUTTON_IDLE: "I'M STILL HERE",
            BUTTON_OKAY: "OK",
            BUTTON_NO : "NO",
            BUTTON_YES : "YES",
            BUTTON_CANCEL : "CANCEL",
            BUTTON_ENTER : "ENTER",
            BUTTON_OTHER : "Other Amount",
            BUTTON_NO_RECEIPT: "NO<br />RECEIPT",
            BUTTON_PRINT_RECEIPT: "PRINT<br />RECEIPT",
            BUTTON_PYO : "Pick Your Own</br>Numbers",

            CHANGE_MESSAGE: "This machine does not give change.<br />Debit cards only.",

            PROMPT_BILL_ACCEPTOR_ERROR: "<h1>TEMPORARILY OUT OF SERVICE</h1>",
            PROMPT_BILL_ACCEPTOR_FULL: "<h1>Bill insertion not available,</h1><h2>please see retailer for assistance.</h2>",
            PROMPT_BILL_ACCEPTOR_FULL_WITH_CREDITS : "<h1>Bill insertion not available,</h1><h2>please play available credits.</h2>",
            PROMPT_BILL_ACCEPTOR_JAMMED: "<h1>Bill Jammed.</h1><h2>Please see retailer for assistance.</h2>",
            PROMPT_BILL_ACCEPTOR_OFFLINE_ERROR: "<h1>Error occurred. Please see retailer.</h1>",
            PROMPT_BILL_ACCEPTOR_MAX_CREDITS: "<h1>CREDITS CANNOT EXCEED $100</h2>",
            PROMPT_CASHLESS: "<h1 class=\"prompt-cashless\">Insert Cash or pay with Debit Card or Mobile</h1>",
            PROMPT_CASHLESS_AUTH_SUCCESS: "<h1>Compete card entry</h1>",
            PROMPT_CASHLESS_PAY_WITH_CARD: "<h1 class=\"prompt-cashless\">To play press 'Pay with Card or Mobile'</h1>",
            PROMPT_CASHLESS_SESSION_ERROR: "<h1>Insert Cash to play</h1><h2>Payment by Card or Mobile not currently available</h2>",
            PROMPT_CHOOSE_AMOUNT: "<h1>Choose the number of tickets</h1>",
            PROMPT_CHOOSE_GAME: "<h1>Choose Game</h1>",
            PROMPT_COIN_ACCEPTOR_JAMMED: "<h1>Coin Jammed.</h1><h2>Please see retailer for assistance.</h2>",
            PROMPT_COIN_ACCEPTOR_ERROR: "<h1>Coin insertion not available</h1><h2>please see retailer for assistance.</h2>",

            PROMPT_COMPLETE_CARD_ENTRY: "<h1>Complete card entry</h1>",
            PROMPT_ERROR_SELECT_ANOTHER_TICKET: "<h1>Error Occurred.</h1><h2>Select another game.</h2>",
            PROMPT_ERROR_DRAW_GAME_UNAVAILABLE: "<h1>Wagering Disabled.</h1><h2>Please try instant game.</h2>",
            PROMPT_ERROR_SELECT_TICKET : "<h1>Error Occurred.</h1><h2>Select another ticket.</h2>",
            PROMPT_GENERIC_SESSION_ERROR: "<h1>Session error code</h1>",
            PROMPT_HOW_MANY : "<h1>Select how many tickets.</h1>",
            PROMPT_INITIALIZING : "<h1>Please wait, initializing!</h1>",
            PROMPT_INSERT_MONEY : "<h1>Insert Money to Purchase</h1>",
            PROMPT_MAKE_SELECTION : "<h1>Please make a selection.</h1>",
            PROMPT_NOT_CONNECTED: "<h1>Startup in progress, please wait!</h1><h2>Do not open door!</h2>",
            PROMPT_OUT_OF_SERVICE : "<h1>TEMPORARILY OUT OF SERVICE</h1>",
            PROMPT_SEE_RETAILER : "<h1>Please see retailer for assistance</h1>",
            PROMPT_SELECT_GAME_MAX_CREDITS : "<h1>CREDITS CANNOT EXCEED $100</h1>",
            PROMPT_SELECT_QP_AMOUNT : "<h1>Select Quick Pick amount.</h1>",
            PROMPT_SELECT_TICKET : "<h1>Select a ticket for more options.</h1>",
            PROMPT_SWIPE_CARD: "<h1>Insert, swipe or tap</h1>",
            PROMPT_VENDING : "<h1>Thank you for your purchase</h1>",
            PROMPT_VERIFY_AGE : "<h1>Scan the barcode of a piece of valid ID</h1><h2>or see the retailer for age verification</h2>",

            PRESENTER_AMOUNT : "Which Quick Pick amount</br>do you want?",
            PRESENTER_BETAMOUNT : "Which Bet Amount</br>do you want?",
            PRESENTER_BETTYPE : "Which Bet Type</br>do you want?",
            PRESENTER_NO_CREDITS : "Insert Money to purchase.",
            PRESENTER_NO_CREDITS_CASHLESS: "Insert Cash or pay with<br />Debit Card to play.",
            PRESENTER_PLAYSLIP_PRESENTED : "Playslip Processing...",
            PRESENTER_QUANITY : "How many tickets do you want?",
            PRESENTER_SAMPLER_CHOSEN : "Your chosen sampler.",
            PRESENTER_SAMPLER_SELECT : "Which sampler do you want?",
            PRESENTER_SPOTS : "How many Spots</br>do you want?",
            PRESENTER_VERIFY_AGE : "Scan your piece of valid ID to verify your age.",

            PRINTER_PAPER_OUT : "<h1>Out of paper,</h1><h2>please see retailer for assistance.</h2>",
            PRINTER_ERROR : "<h1>Printer error,</h1><h2>please see retailer for assistance.</h2>",

            MESSAGE_ADDON: "AddOn: ",
            MESSAGE_AGE_TIMEOUT_CONFIRMATION : "<h1>Attention</h1><p>This session is about to timeout.</p><p>If you would like to continue, please press OK.</p>",
            MESSAGE_BETAMOUNT: "Bet Amount: ",
            MESSAGE_BETSLIP_ERROR : "<h1>Playslip Error</h1><p>Sorry. There was a problem processing your playslip, please verify all your selections.</p>",
            MESSAGE_BETSLIP_SUPPRESSED : "<h1>Playslip Error</h1><p>Sorry. Not currently accepting playslips.</p>",
            MESSAGE_BOARD_IN_SEQUENCE : "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_BOARDS: "Boards: ",
            MESSAGE_BOTH_QP_AND_NUMBERS : "<h1>Playslip Error</h1><p>Sorry. Invalid quick pick selection. Check your playslip.</p>",
            MESSAGE_CASHLESS_COMM_LOSS : "<h1>Communication Error.</h1><h1>We apologize for the inconvenience.</h1><h1>Your card will be adjusted accordingly.</h1>",
            MESSAGE_CASHLESS_IDLE: "<h1>Are you there?</h1><h1>Purchase session will end<br />if you do not respond.</h1>",
            MESSAGE_CASHLESS_PRINT_RECEIPT: "<h1>You have used all your credits</h1><h1>Thank you for playing.</h1>",
            MESSAGE_CASHLESS_PRINTER_UNAVAILABLE: "<h1>No receipts can be printed currently.</h1><h1>Would you like to continue the purchase with your card?</h1>",
            MESSAGE_CASHLESS_UNAVAILABLE: "<h1>Pay with Debit Unavailable.</h1><h1>Please use cash</h1>",
            MESSAGE_CONFIRM_BETSLIP : "<h2>Please confirm your wager:</h2>",
            MESSAGE_DOUBLETAKE: "DoubleTake: ",
            MESSAGE_DRAWS: "Draws: ",
            MESSAGE_EMPTY_BETSLIP : "<h1>Playslip Error</h1><p>Sorry. Invalid board data. Please check your playslip.</p>",
            MESSAGE_END_DAY_WARNING: "<h1>The terminal will reset in<br />10 minutes.</h1><h1>Please complete your purchase<br />within 10 minutes.</h1>",
            MESSAGE_END_DAY_COMPLETE: "<h1>Session ended.</h1><h1>You have only been charged for purchases vended.</h1><h1>Collect your receipt below.</h1>",
            MESSAGE_ERROR_DRAW_BREAK : "<h1>Game Unavailable</h1><p>Please make another selection.</p>",
            MESSAGE_ERROR_DRAW_IN_PROGRESS : "<h1>Game Unavailable</h1><h2>Please make another selection.</h2>",
            MESSAGE_ERROR_PRINTING_BETSLIP_WAGER :  "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_FUNCTION_NOT_AVAILABLE: "<h1>Playslip Error</h1><p>Sorry, function not available.</p>",
            MESSAGE_GAME_NOT_AVAILABLE: "The selected game is not available",
            MESSAGE_IDLE_TIMEOUT_CONFIRMATION : "<h1>Attention</h1><p>This session will timeout in 30 seconds.</p><p>If you would like to continue, please press OKAY.</p>",
            MESSAGE_INSTANT_GAMES_UNAVAILABLE_WITH_CREDIT: "<h1>Instant games unavailable</h1><p>Would you like a continue with just online games?</p><p>Selecting no issues a refund</p>",
            MESSAGE_INSUFFICIENT_FUNDS_CASHLESS: "<h1>Insufficient Credits</h1><h2>You have made a selection that exceeds your current credit amount.</h2>",
            MESSAGE_INSUFFICIENT_FUNDS : "<h1>Insufficient Credits</h1><h2>Please insert more money to purchase.</h2>",
            MESSAGE_INVALID_ADV_PLAY_SELECTION : "<h1>Playslip Error</h1><p>Sorry. Multiple advance options selected. Check your playslip.</p>",
            MESSAGE_INVALID_BARCODE :  "<h1>Sorry - Invalid barcode</h1>",
            MESSAGE_INVALID_BET_AMOUNT : "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_INVALID_BET_TYPE : "<h1>Playslip Error</h1><p>Sorry. Multiple bet amounts selected. Please check your playslip.</p>",
            MESSAGE_INVALID_BOARD_DATA : "<h1>Playslip Error</h1><p>Sorry. Invalid board data. Please check your playslip.</p>",
            MESSAGE_INVALID_DRAWS : "<h1>Playslip Error</h1><p>Sorry. Multiple draws are not allowed. Please check your selections.</p>",
            MESSAGE_INVALID_JOKER_SELECT : "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_INVALID_QP : "<h1>Playslip Error</h1><p>Sorry. Invalid quick pick selection. Please check your playslip.</p>",
            MESSAGE_INVALID_SPOTS : "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_LICENSE_EXPIRED : "<h1>Sorry - This piece of ID is not valid</h1>",
            MESSAGE_LICENSE_INVALID : "<h1>Sorry - This piece of ID is not valid</h1>",
            MESSAGE_LICENSE_NOT_AUTHORIZED: "<h1>Purchase available for 18+ only</h1>",
            MESSAGE_MAX_CREDITS: "<h1>Credits cannot exceed %1</h1><p>Please remove your bill.</p>",
            MESSAGE_MEGAPLIER: "Megaplier: ",
            MESSAGE_MISSING_BOARD : "<h1>Playslip Error</h1><p>Sorry. Empty board. Please check your playslip.</p>",
            MESSAGE_MULTI_BET_AMOUNT_SELECT : "<h1>Playslip Error</h1><p>Sorry. Multiple bet amounts selected. Check your playslip.</p>",
            MESSAGE_MULTI_SPOTS_SELECT : "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_NO_JOKER : "<h1>Playslip Error</h1><p>Joker selections not available for this game. please check your selections.</p>",
            MESSAGE_NO_RESPONSE_TIMEOUT : "<h1>Vending Error.</h1><p>Transaction timeout. Please seek assistance.</p>",
            MESSAGE_NUMBERPAD: "<h1>Enter amount up to <br />%1 to load as credits</h1>",
            MESSAGE_POWERPLAY: "PowerPlay: ",
            MESSAGE_PROMOTION_CASH : "<h1>Congratulations</h1><p>You won cash!</p>",
            MESSAGE_PROMOTION_COUPON : "<h1>Congratulations</h1><p>You got a coupon!</p>",
            MESSAGE_PROMOTION_DOUBLE : "<h1>Congratulations</h1><p>Your winnings will be doubled!</p>",
            MESSAGE_PROMOTION_FREE_TICKET : "<h1>Congratulations</h1><p>You won a free ticket!</p>",
            MESSAGE_PROMOTION_MARKUP : "<h1>Congratulations</h1><p>Your winnings will be marked up!</p>",
            MESSAGE_PROMOTION_RAFFLE : "<h1>Congratulations</h1><p>You got a raffle entry!</p>",
            MESSAGE_PROMOTION_VOUCHER : "<h1>Congratulations</h1><p>You got a voucher!</p>",
            MESSAGE_PYO_BETSLIP_PRINTING: "Your Pick Your Own ticket is printing",
            MESSAGE_QUICKPAD: "<h1>Choose amount to load as credits</h1>",
            MESSAGE_REFUND_PRINTING : "<h1>REFUND SLIP PRINTING</h1>",
            MESSAGE_REINVESTMENT_APPLIED : "<h1>Winnings have been</br>applied to your Credits.</h1>",
            MESSAGE_REINVESTMENT_APPLIED_TICKET : "<h1>Winnings have been</br>applied to your Credits.</br></br>Tickets are being printed.</h1>",
            MESSAGE_REINVESTMENT_CASH: " Cash",
            MESSAGE_REINVESTMENT_CONFIRM : "</h1><p>Would you like</br>to use your</br>winnings now?</p>",
            MESSAGE_REINVESTMENT_CONFIRM_HEADER : "<h1>This ticket is a winner</h1>",
            MESSAGE_REINVESTMENT_CONFIRM_TICKETS : "</h1>Would you like to use your</br>winnings and print tickets now?</h1>",
            MESSAGE_REINVESTMENT_EXCHANGE_TICKET: "Exchange Ticket</br>",
            MESSAGE_REINVESTMENT_FREE_TICKET: " Free Ticket(s)</br>",
            MESSAGE_REINVESTMENT_NOT_APPLIED : "<h1>Please see</br>retailer to redeem</br>your ticket.</h1>",
            MESSAGE_REINVESTMENT_VERIFY_AGE: "<h1>This ticket is a winner.<h1><h2>You can reinvest your winnings. First you must verify<br />your age, then you can re-scan your ticket.</h2><h2>Otherwise, see retailer to redeem your winnings.</h2>",
            MESSAGE_SCRIPT_ERROR :  "<h1>Playslip Error</h1><p>There was a problem processing your betslip, please verify all your selections.</p>",
            MESSAGE_SPOTS: "Spots: ",
            MESSAGE_TICKET_ALREADY_PAID : "<h1>Please see retailer.</br></h1><p>This ticket was already paid.</p>",
            MESSAGE_TICKET_DRAWS_REMAINING : "<h1>Please try again.</br></h1><p>This ticket is not a winner.<br>There are still remaining draws.</p>",
            MESSAGE_TICKET_NOT_A_WINNER : "<h1>Please try again.</br></h1><p>This ticket is not a winner.</p>",
            MESSAGE_TICKET_EXPIRED: "<h1>Ticket has expired.</h1>",
            MESSAGE_TICKET_NOT_A_WINNER_DRAWS_REMAIN : "<h1>Sorry, not a winner.</br></h1><p>Check again after remaining draws.</p>",
            MESSAGE_TICKET_RESULTS_NOT_IN : "<h1>Results not available.</br></h1><p>Results are not available yet for this game. Please try again later.</p>",
            MESSAGE_TICKET_SCAN_ERROR : "<h1>Please see retailer.</br></h1><p>There was a problem encountered reading this ticket.</p>",
            MESSAGE_TICKET_SEE_RETAILER : "<h1>Please see retailer.</br></h1><p>Please see retailer for further information.</p>",
            MESSAGE_TICKET_WINNER : "<h1>Please see retailer.</br></h1><p>This ticket is a winner.</p>",
            MESSAGE_TO_FEW_MARKS : "<h1>Playslip Error</h1><p>Sorry. Too few marks. Please check your playslip.</p>",
            MESSAGE_TO_MANY_BET_TYPES : "<h1>Playslip Error</h1><p>Sorry, multiple bet types selected. Check your playslip.</p>",
            MESSAGE_TO_MANY_DRAWS : "<h1>Playslip Error</h1><p>Sorry, Check multi-draw options on your playlip.</p>",
            MESSAGE_TOO_MANY_MARKS : "<h1>Playslip Error</h1><p>Sorry. Too many marks. Please check your playslip.</p>",
            MESSAGE_TOO_FEW_MARKS : "<h1>Playslip Error</h1><p>Sorry. Too few marks. Please check your playslip.</p>",
            MESSAGE_TOTALPRICE: "Total Price: ",
            MESSAGE_VENDING_ERROR : "<h1>An error has occurred</h1><h2>please select another ticket or see retailer for assistance.</h2>",
            MESSAGE_VENDING_ERROR_DISPENSING : "<h1>Dispensing Error</h1><h2>There was a problem dispensing your selection.</h2>",
            MESSAGE_VENDING_ERROR_MULTI_TICKET : "<h1>Dispensing Error</h1><h2>Could not print all tickets, seek assistance.</h2>",
            MESSAGE_VENDING_ERROR_TIMEOUT : "<h1>Vending Error</h1><h2>Transaction timeout. Please seek assistance.</h2>",
            CURRENCY_SYMBOL : "$",
            CURRENCY_DECIMAL : "."
        },
        fr : {

            AVAILABLE_CREDIT : "Crédits disponibles:",
            INVALID : "NON VALIDE",
            SOLD_OUT : "Épuisé",
            ERROR : "Erreur",
            FLIP : "Inverser l'affichage",
            HELP : "Aide",
            LANGUAGE : "English",
            PLAY : "JOUER",
            PLAYS : "PIÈCES",

            BUTTON_OKAY : "OK",
            BUTTON_NO : "Non",
            BUTTON_YES : "Oui",
            BUTTON_CANCEL : "Annuler",
            BUTTON_ENTER : "Entrer",
            BUTTON_PYO : "BUTTON_PYO",

            PROMPT_ERROR_SELECT_TICKET : "Ocurrió un error. Seleccione un boleto.",
            PROMPT_ERROR_SELECT_ANOTHER_TICKET : "Ocurrió un error. Seleccione otro boleto.",
            PROMPT_INITIALIZING : "<h1>Initialisation en cours; veuillez patienter.</h1>",
            PROMPT_INSERT_MONEY : "Insérez de l’argent pour faire un achat.",
            PROMPT_NOT_CONNECTED : "<h1>Démarrage en cours; veuillez patienter.</h1><h2>N’ouvrez pas la porte. </h2>",
            PROMPT_VERIFY_AGE : "<h2>Placez le code à barres d'une pièce d'identité valide sous le lecteur ou adressez-vous au détaillant pour vérification de l'âge.</h2>",
            PROMPT_SELECT_TICKET : "Para más opciones, seleccione un boleto.",
            PROMPT_SELECT_QP_AMOUNT : "Seleccione la cantidad para una jugada al azar.",
            PROMPT_SELECT_GAME_MAX_CREDITS : "<h1>CRÉDITS MAXIMUM ACCEPTÉS 100 $</h1>",
            PROMPT_HOW_MANY : "Seleccione la cantidad de boletos.",
            PROMPT_VENDING : "Merci pour votre achat",
            PROMPT_SEE_RETAILER : "Veuillez vous adresser au détaillant.",
            PROMPT_CHOOSE_AMOUNT : "<h1>Choisissez le nombre de billets de loterie.</h1>",
            PROMPT_CHOOSE_GAME : "<h1>Choisissez le jeu</h1>",
            PROMPT_OUT_OF_SERVICE : "<h1>TEMPORAIREMENT HORS D’USAGE</h1>",

            PROMPT_BILL_ACCEPTOR_ERROR: "<h1>TEMPORAIREMENT HORS D’USAGE</h1>",
            PROMPT_BILL_ACCEPTOR_FULL: "<h1>Insertion de billets non disponible</h1><h2>veuillez vous adresser au détaillant.</h2>",
            PROMPT_BILL_ACCEPTOR_FULL_WITH_CREDITS : "<h1>Insertion de billets non disponible</h1><h2>veuillez utiliser les crédits disponibles.</h2>",
            PROMPT_BILL_ACCEPTOR_JAMMED: "<h1>Billet coincé.</h1><h2>veuillez vous adresser au détaillant.</h2>",
            PROMPT_BILL_ACCEPTOR_MAX_CREDITS: "CRÉDITS MAXIMUM ACCEPTÉS 100 $",
            PROMPT_COIN_ACCEPTOR_JAMMED: "<h1>Monnaie coincée</h1><h2>veuillez vous adresser au détaillant.</h2>",
            PROMPT_COIN_ACCEPTOR_ERROR: "<h1>Insertion de monnaie non disponible</h1><h2>veuillez vous adresser au détaillant.</h2>",

            PRESENTER_NO_CREDITS : "Insérez de l’argent pour faire un achat",
            PRESENTER_QUANITY : "Combien de billets de loterie voulez-vous?",
            PRESENTER_AMOUNT : "¿Cuál es la cantidad de jugadas al azar, deseada?",
            PRESENTER_VERIFY_AGE : "Présentez une pièce d’identité valide sous le lecteur<br>de codes à barres pour vérification de l’âge.",
            PRESENTER_PLAYSLIP_PRESENTED : "Playslip Processing...",

            PRESENTER_SAMPLER_SELECT : "Which sampler do you want?",
            PRESENTER_SAMPLER_CHOSEN : "You chosen sampler.",

            PRINTER_PAPER_OUT : "<h1>Manque de papier</h1><h2>Veuillez vous adresser au détaillant.</h2>",
            PRINTER_ERROR : "<h1>Erreur d’imprimante</h1><h2>Veuillez vous adresser au détaillant.</h2>",

            MESSAGE_AGE_TIMEOUT_CONFIRMATION : "<h1>Attention</h1><p>La session expire bientôt.</p><p>Si vous souhaitez poursuivre, veuillez appuyer sur OK.</p>",

            MESSAGE_INSUFFICIENT_FUNDS : "<h1>Crédits insuffisants</h1><h2>Veuillez insérer de l’argent pour faire votre achat</h2>",
            MESSAGE_TICKET_NOT_A_WINNER : "<h1></br></h1><p>Este boleto no es ganador. Inténtelo nuevamente.</p>",
            MESSAGE_TICKET_WINNER : "<h1></br></h1><p>Boleto Ganador. Favor de pasar al Cajero/Agente.</p>",
            MESSAGE_TICKET_SEE_RETAILER : "<h1>Please see retailer.</br></h1><p>Please see retailer for further information.</p>",
            MESSAGE_TICKET_DRAWS_REMAINING : "<h1>Please try again.</br></h1><p>This ticket is not a winner.<br>There are still remaining draws.</p>",
            MESSAGE_TICKET_SCAN_ERROR : "<h1></br></h1><p>Favor de ver al cajero/agente. Se encontró un problema al leerse este boleto.</p>",
            MESSAGE_VENDING_ERROR : "<h1>Une erreur s'est produite</h1><h2>veuillez choisir un autre billet de loterie ou vous adresser au détaillant.</h2>",
            MESSAGE_TICKET_ALREADY_PAID : "“<h1>Favor de consultar al cajero.</br></h1><p>Boleto previamente canjeado</p>",
            MESSAGE_TICKET_RESULTS_NOT_IN : "“<h1>Resultados no disponibles.</br<></h1><p>Los resultados no están disponibles para este juego todavía. Favor de intentarlo nuevamente, luego.</P>",

            MESSAGE_LICENSE_INVALID : "<h1>Désolé - Pièce d'identité non valide</h1>",
            MESSAGE_LICENSE_EXPIRED : "<h1>Désolé - Pièce d'identité non valide</h1>",
            MESSAGE_LICENSE_NOT_AUTHORIZED: "<h1>Achat pour les 18+ uniquement</h1>",
            MESSAGE_INVALID_BARCODE : "<h1>Désolé - Code à barres non valide</h1>",

            MESSAGE_CONFIRM_BETSLIP : "<h2>Favor de confirmar la información de su jugada:</h2>",
            MESSAGE_BOARDS: "Tableros: ",
            MESSAGE_SPOTS: "Manchas: ",
            MESSAGE_DRAWS: "Sorteos: ",
            MESSAGE_BETAMOUNT: "Cantidad de Apuesta: ",
            MESSAGE_POWERPLAY: "PowerPlay: ",
            MESSAGE_MEGAPLIER: "Megaplier: ",
            MESSAGE_DOUBLETAKE: "DoubleTake: ",
            MESSAGE_TOTALPRICE: "Precio Total: ",

            MESSAGE_PROMOTION_CASH : "<h1>Felicitaciones</h1><p>Ganaste cash!</p>",
            MESSAGE_PROMOTION_COUPON : "<h1>Felicitaciones</h1><p>Ganaste un cupón!</p>",
            MESSAGE_PROMOTION_DOUBLE : "<h1>Felicitaciones</h1><p>Has duplicado tus ganancias!</p>",
            MESSAGE_PROMOTION_FREE_TICKET : "<h1>Felicitaciones</h1><p>Ganaste un boleto gratis!</p>",
            MESSAGE_PROMOTION_MARKUP : "<h1>Felicitaciones</h1><p>Sus ganancias se incrementarán!</p>",
            MESSAGE_PROMOTION_RAFFLE : "<h1>Felicitaciones</h1><p>Tienes una entrada de rifa!</p>",
            MESSAGE_PROMOTION_VOUCHER : "<h1>Felicitaciones</h1><p>Tienes un vale!</p>",

            MESSAGE_REFUND_PRINTING : "<h1>IMPRESSION DU COUPON DE REMBOURSEMENT</h1>",

            MESSAGE_TICKET_EXPIRED: "<h1>El boleto ha caducado.</h1>",

            MESSAGE_REINVESTMENT_CONFIRM_HEADER : "<h1>Es un GANADOR.</br></h1><h1>",
            MESSAGE_REINVESTMENT_CONFIRM : "</h1><p>¿le gustaría utilizar</br>sus ganancias ahora?</p>",
            MESSAGE_REINVESTMENT_CONFIRM_TICKETS : "</h1><p>¿le gustaría utilizar sus ganancias</br>he imprimir boletos ahora?</p>",
            MESSAGE_REINVESTMENT_APPLIED : "<h1>Las Ganancias han sido</br>aplicadas a su crédito.</h1>",
            MESSAGE_REINVESTMENT_APPLIED_TICKET : "<h1>Las Ganancias han sido</h1></br><h1>aplicadas a su crédito.</br></br>Los boletos NO han sido impresos.</h1>",
            MESSAGE_REINVESTMENT_NOT_APPLIED : "<h1>Favor de ver a su</br>agente para reclamar</br>su boleto.</h1>",
            MESSAGE_REINVESTMENT_CASH: " Cash</br>",
            MESSAGE_REINVESTMENT_FREE_TICKET: " Boleto(s) gratuito</br>",
            MESSAGE_REINVESTMENT_EXCHANGE_TICKET: "Boleto de Intercambio</br>",
            MESSAGE_REINVESTMENT_VERIFY_AGE: "<h1>Este boleto es un ganador.<h1><p></br>Usted puede reinvertir sus ganancias.<br>Primero debe verificar su edad.<br>A continuación, puede volver a escanear su billete.<br><br>De lo contrario, consulte al<br /> minorista para canjear sus ganancias.</p>",

            MESSAGE_PYO_GAME_NOT_AVAILABLE: "El juego seleccionado no está disponible",
            MESSAGE_PYO_BETSLIP_PRINTING: "Tu Elige el ticket está imprimiendo",

            /* NOT DEFINED IN SRS */
            MESSAGE_BOARD_IN_SEQUENCE : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",
            MESSAGE_INVALID_BET_AMOUNT : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",
            MESSAGE_NO_JOKER : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",
            MESSAGE_INVALID_SPOTS : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",
            MESSAGE_MULTI_SPOTS_SELECT :  "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",
            MESSAGE_INVALID_JOKER_SELECT :  "<h1>Error en boleta de Juego</h1><p>Lo sentimos. La selección de “Joker” no está disponible para este juego, favor de verificar su selección.</p>",
            MESSAGE_INVALID_DRAWS :  "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Sorteos múltiples  no están permitidos. favor de verificar su selección.</p>",
            MESSAGE_BETSLIP_ERROR : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Se ha presentado un problema al procesar su boleta de juego, favor de verificar su selección.</p>",

            /* DEFINED IN SRS */
            MESSAGE_TO_FEW_MARKS : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Muy pocas marcas.  Favor de verificar su boleta de juego.</p>",
            MESSAGE_TO_MANY_MARKS : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Too many marks. Favor de verificar su boleta de juego.</p>",
            MESSAGE_INVALID_BET_TYPE :  "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Múltiples cantidades de apuestas seleccionadas. Favor de verificar su boleta de juego.</p>",
            MESSAGE_EMPTY_BETSLIP : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Datos de jugada inválidos. Favor de verificar su boleta de juego.</p>",
            MESSAGE_INVALID_BOARD_DATA : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Datos de jugada inválidos. Favor de verificar su boleta de juego.</p>",
            MESSAGE_MISSING_BOARD : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Jugada vacía. Favor de verificar su boleta de juego.</p>",
            MESSAGE_TO_MANY_DRAWS : "<h1>Error en boleta de Juego</h1><p>Sorry, Verifique la opción de múltiples sorteos en su boleta de juego.</p>",
            MESSAGE_MULTI_BET_AMOUNT_SELECT : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Cantidad de múltiples apuestas seleccionada. Favor de verificar su boleta de juego.</p>",
            MESSAGE_INVALID_ADV_PLAY_SELECTION : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Cantidad de múltiples sorteos avanzados seleccionada. Favor de verificar su boleta de juego.</p>",
            MESSAGE_BOTH_QP_AND_NUMBERS : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Selección invalida de jugada aleatoria. Favor de verificar su boleta de juego.</p>",
            MESSAGE_BETSLIP_SUPPRESSED : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. En estos momentos, no se  aceptan boletas de juegos.</p>",
            MESSAGE_TO_MANY_BET_TYPES : "<h1>Error en boleta de Juego</h1><p>Lo sentimos. Múltiples tipos de apuestas seleccionadas. Favor de verificar su boleta de juego.</p>",

MESSAGE_MAX_CREDITS: "<h1>Credits cannot exceed %1</h1><p>Please remove your bill.</p>",

            CURRENCY_SYMBOL : "$",
            CURRENCY_DECIMAL : ","
        }
    };

    var chosen = "en";
    var language = languages[chosen];

    // Available functionality
    return {

        setLanguage : function(selected) {

            chosen = selected || "fr";
            language = languages[chosen];
        },

        getLanguage : function() {

            return chosen;
        },

        get : function(key) {

            var value = "", index;

            if (language.hasOwnProperty(key)) {

                value = language[key];

                for (index = 1; index < arguments.length; index++) {

                    value = value.replace(("%" + index), arguments[index]);
                }
                
            } else {
              
              return key;  
            }


            return value;
        },

        getFileUrl : function(file) {

            var request;
            var url = "";

            if (file !== undefined && file !== "") {

                if (file.indexOf("-webkit") === 0) {

                    return file;
                }
                else {

                    request = new XMLHttpRequest();
                    url = "content/images/" + chosen + "/" + file;
                    request.open('HEAD', url, false);
                    request.send();

                    if (request.status !== 200) {

                        url = "content/images/en/" + file;
                    }
                }
            }
            else {
                return "none";
            }

            return ("url('" + url + "')");
        },

        getFile : function(file) {

            var request;
            var url = "";

            if (file !== undefined && file !== "") {

                request = new XMLHttpRequest();
                url = "content/images/" + chosen + "/" + file;
                request.open('HEAD', url, false);
                request.send();

                if (request.status !== 200) {

                    url = "content/images/en/" + file;
                }
            }

            return url;
        },

        getCurrency : function(value, decimals) {

            var output = "";
            var amount;
            var currentLanguage = GTGUI.Language.getLanguage();

            if (typeof value === "string") {

                if (value.charAt(0) === "$") {

                    amount = parseFloat(value.substr(1));
                }
                else {

                    amount = parseFloat(value.substr(3));
                }
            }
            else {

                amount = value;
            }

            if (isNaN(amount)) {

                output = language.CURRENCY_SYMBOL;
            }
            else {

                if (currentLanguage === "fr"){
                    if (amount % 1 != 0){
                        amount = amount.toFixed(2);
                    }
                    output = new String(amount + " " + language.CURRENCY_SYMBOL).replace(".", ",");
                }
                else {
                    output = new String(language.CURRENCY_SYMBOL + amount);
                }

                if ((decimals !== false) || (amount % 1 !== 0)) {

                    var index  = output.indexOf(language.CURRENCY_DECIMAL);


                    if (index < 0) {
                        if (currentLanguage === "fr") {
                            output = amount;
                            output += language.CURRENCY_DECIMAL + "00 " + language.CURRENCY_SYMBOL;
                        }
                        else {
                            output += language.CURRENCY_DECIMAL + "00";
                        }
                    }
                    else if (index === (output.length - 2)) {

                        output += '0';
                    }
                }
            }

            return output;
        }
    };
}();