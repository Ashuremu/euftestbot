require('dotenv').config();

const telegramApi = require("./axios");
const db = require("./databasepg");
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const QRCode = require('qrcode');
const FormData = require('form-data');
const fs = require('fs');

// Environment variables - removed PayMongo related variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PAYMONGO_API_KEY = process.env.PAYMONGO_API_KEY;
const ENCODED_API_KEY = process.env.ENCODED_API_KEY;
const PAYMONGO_WEBHOOK_URL = process.env.PAYMONGO_WEBHOOK_URL;

// Validate required environment variables - removed PayMongo related checks
const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Define states
const STATES = {
    SERVICE_SELECTION: 'SERVICE_SELECTION',
    DESTINATION_SELECTION: 'DESTINATION_SELECTION',
    PAYMENT_CONFIRMATION: 'PAYMENT_CONFIRMATION',
    VALIDATE_TRANSACTION: 'VALIDATE_TRANSACTION',
    VIEW_TICKETS: 'VIEW_TICKETS',
    VIEW_OWNED_TICKETS: 'VIEW_OWNED_TICKETS'
};

// User context storage
const userContexts = new Map();

function getUserContext(chatId) {
    if (!userContexts.has(chatId)) {
        userContexts.set(chatId, {
            state: STATES.SERVICE_SELECTION,
            page: 1,
            ticketPage: 1,
            destination: null,
            price: null,
            paymentMethod: null,
            isTestPayment: false
        });
    }
    return userContexts.get(chatId);
}

function escapeMarkdown(text) {
    // Characters that need to be escaped in MarkdownV2
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    
    // Escape each special character
    return text.split('').map(char => {
        return specialChars.includes(char) ? `\\${char}` : char;
    }).join('');
}

async function sendMessage(messageObj, messageText, keyboard = null) {
    try {
        const chatId = messageObj.chat.id;
        const messageData = {
            chat_id: chatId,
            text: escapeMarkdown(messageText),
            parse_mode: 'MarkdownV2'
        };

        if (keyboard) {
            messageData.reply_markup = {
                keyboard: keyboard,
                one_time_keyboard: true,
                resize_keyboard: true
            };
        }

        return await telegramApi.post("sendMessage", messageData);
    } catch (error) {
        console.error("Error sending message:", error.message);
        throw error;
    }
}

async function handleMessage(messageObj) {
    try {
        if (!messageObj || !messageObj.text) {
            return;
        }

        const messageText = messageObj.text;
        console.log("Received message:", messageText);
        
        // First, ensure user exists in database
        await ensureUserExists(messageObj);
        
        const context = getUserContext(messageObj.chat.id);
        
        if (messageText.charAt(0) === "/") {
            const command = messageText.substr(1).toLowerCase();
            switch (command) {
                case "start":
                    return await handleStart(messageObj);
                case "pay":
                    context.isTestPayment = false;
                    context.state = STATES.DESTINATION_SELECTION;
                    return await handlePayCommand(messageObj);
                case "view":
                    context.state = STATES.VIEW_TICKETS;
                    context.ticketPage = 1;
                    return await handleViewOwnedTickets(messageObj);
                case "validate":
                    return await handleValidateCommand(messageObj);
                case "testpay":
                    context.isTestPayment = true;
                    context.state = STATES.DESTINATION_SELECTION;
                    return await handleTestPayment(messageObj);
                case "help":
                    return await sendMessage(messageObj,
                        "Available commands:\n" +
                        "/start - Start the bot\n" +
                        "/pay - Pay EUF Ticket\n" +
                        "/view - View Owned EUF Tickets\n" +
                        "/validate - Validate Transaction\n" +
                        "/testpay - Test Payment (Development Only)\n" +
                        "/qrcodetest - Test QR Code Generation\n" +
                        "/help - Show this help message\n" +
                        "/cancel - Cancel current operation"
                    );
                case "cancel":
                    context.state = STATES.SERVICE_SELECTION;
                    return await sendMessage(messageObj, 
                        "Operation cancelled. Type /help to see available commands."
                    );
                case "qrcodetest":
                    return await handleQRCodeTest(messageObj);
                default:
                    return await handleCommandBasedOnState(messageObj, command, context);
            }
        } else {
            // Handle non-command messages based on state
            switch (context.state) {
                case STATES.VIEW_TICKETS:
                    return await handleViewOwnedTickets(messageObj);
                default:
                    return await handleMessageBasedOnState(messageObj, context);
            }
        }
    } catch (error) {
        console.error("Error handling message:", error);
        throw error;
    }
}

async function handleCommandBasedOnState(messageObj, command, context) {
    switch (context.state) {
        case STATES.DESTINATION_SELECTION:
            const destinationResult = await db.query("SELECT name FROM destinations");
            const validDestinations = destinationResult.rows.map(d => d.name.toLowerCase());
            
            if (validDestinations.includes(command)) {
                context.destination = command;
                return await handleDestinationSelection(messageObj, command);
            }
            break;
            
        case STATES.PAYMENT_CONFIRMATION:
            if (['gcash', 'qrph', 'card'].includes(command)) {
                return await handlePaymentMethod(messageObj, command);
            }
            break;
    }
    
    return await sendMessage(messageObj, 
        "Unknown command. Try /help to see available commands"
    );
}

async function handleMessageBasedOnState(messageObj, context) {
    const messageText = messageObj.text;
    
    // Global cancel button handler
    if (messageText === 'Cancel' || messageText === 'Back to Menu') {
        // Check if there's a pending transaction to cancel
        if (context.state === STATES.PAYMENT_CONFIRMATION) {
            const pendingTransaction = await db.query(
                "SELECT paymongo_payment_id FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = false ORDER BY timestamp DESC LIMIT 1",
                [messageObj.chat.id.toString()]
            );

            if (pendingTransaction.rows.length > 0) {
                const paymentId = pendingTransaction.rows[0].paymongo_payment_id;
                await archivePaymongoLink(paymentId);
                
                // Update transaction status to cancelled
                await db.query(
                    "UPDATE euf_transactions SET status = 'cancelled' WHERE paymongo_payment_id = $1",
                    [paymentId]
                );
                
                await sendMessage(messageObj, 
                    "Payment link has been cancelled. You can start a new transaction."
                );
            }
        }

        context.state = STATES.SERVICE_SELECTION;
        return await handleStart(messageObj);
    }

    switch (context.state) {
        case STATES.SERVICE_SELECTION:
            return await handleServiceSelection(messageObj);
            
        case STATES.VALIDATE_TRANSACTION:
            return await handleTransactionValidation(messageObj);
            
        case STATES.VIEW_OWNED_TICKETS:
            return await handleViewOwnedTickets(messageObj);
            
        case STATES.DESTINATION_SELECTION:
            // Check if the message is a valid destination
            const destinationResult = await db.query(
                "SELECT name FROM destinations WHERE name = $1",
                [messageText]
            );
            
            if (destinationResult.rows.length > 0) {
                context.destination = messageText;
                context.state = STATES.PAYMENT_CONFIRMATION;
                return await handleDestinationSelection(messageObj, messageText);
            }
            
            return await sendMessage(messageObj,
                "Please select a valid destination from the buttons provided.",
                [['Cancel']]
            );
            
        case STATES.PAYMENT_CONFIRMATION:
            return await handlePaymentConfirmation(messageObj);
            
        default:
            context.state = STATES.SERVICE_SELECTION;
            return await handleStart(messageObj);
    }
}

async function ensureUserExists(messageObj) {
    try {
        const chatId = messageObj.chat.id.toString();
        const username = messageObj.from.username || null;
        const firstName = messageObj.from.first_name || null;
        const lastName = messageObj.from.last_name || null;

        // Check if user exists
        const userResult = await db.query(
            "SELECT id FROM users WHERE id = $1",
            [chatId]
        );

        if (userResult.rows.length === 0) {
            // Create new user
            await db.query(
                `INSERT INTO users (id, email, password, token_key, name)
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    chatId,
                    `${chatId}@telegram.user`,
                    'telegram_auth',
                    `token_${uuidv4()}`,
                    `${firstName} ${lastName}`.trim()
                ]
            );
        }
    } catch (error) {
        console.error("Error ensuring user exists:", error);
    }
}

// Keyboard layouts
const serviceKeyboard = [
    ['Pay EUF Ticket'],
    ['View Owned EUF Tickets'],
    ['Validate Transaction']
];

async function handleStart(messageObj) {
    const keyboard = {
        keyboard: [['/start']],
        one_time_keyboard: true,
        resize_keyboard: true
    };
    
    await sendMessage(messageObj, 
        "👋 Welcome to EUF system!\nPlease select a service:",
        serviceKeyboard
    );
    
    const context = getUserContext(messageObj.chat.id);
    context.state = STATES.SERVICE_SELECTION;
}

async function handleServiceSelection(messageObj) {
    const userChoice = messageObj.text;
    const context = getUserContext(messageObj.chat.id);
    
    switch (userChoice) {
        case "Pay EUF Ticket":
            // Fetch destinations from database
            const result = await db.query("SELECT name FROM destinations");
            const destinations = result.rows.map(d => [d.name]);
            destinations.push(['Cancel']);
            
            await sendMessage(messageObj, 
                "🏝️ Please select from the available options:",
                destinations
            );
            context.state = STATES.DESTINATION_SELECTION;
            break;
            
        case "View Owned EUF Tickets":
            context.state = STATES.VIEW_OWNED_TICKETS;
            await handleViewOwnedTickets(messageObj);
            break;
            
        case "Validate Transaction":
            await sendMessage(messageObj,
                "🔍 Please enter the Transaction ID or send a QR code image\nselect \"Cancel\" to go back",
                [['Cancel']]
            );
            context.state = STATES.VALIDATE_TRANSACTION;
            break;
    }
}

async function handlePayCommand(messageObj) {
    const result = await db.query("SELECT name FROM destinations");
    const destinations = result.rows.map(d => d.name);
    
    // Create keyboard with destination buttons
    const keyboard = destinations.map(d => [d]);
    keyboard.push(['Cancel']); // Add cancel button at the bottom
    
    return await sendMessage(messageObj, 
        "Please select a destination:",
        keyboard
    );
}

async function handleDestinationSelection(messageObj) {
    const selectedDestination = messageObj.text;
    const context = getUserContext(messageObj.chat.id);
    
    if (selectedDestination === 'Cancel') {
        context.state = STATES.SERVICE_SELECTION;
        return await handleStart(messageObj);
    }
    
    // Get destination details from database
    const result = await db.query(
        "SELECT name, price FROM destinations WHERE name = $1",
        [selectedDestination]
    );
    
    if (result.rows.length === 0) {
        return await sendMessage(messageObj, "Invalid destination selected");
    }
    
    const destination = result.rows[0];
    context.destination = destination;
    
    await sendMessage(messageObj,
        `💳 Confirm your Payment\n` +
        `🏝️ Destination: ${destination.name}\n` +
        `💰 Amount: ${destination.price}\n\n` +
        `Please confirm for payment`,
        [
            ['Proceed to payment'],
            ['Change Destination'],
            ['Cancel']
        ]
    );

    
    switch (selectedDestination) {
        case 'Proceed to payment':
            context.state = STATES.PAYMENT_CONFIRMATION;
            break;
        case 'Change Destination':
            context.state = STATES.DESTINATION_SELECTION;
            break;
        case 'Cancel':
            context.state = STATES.SERVICE_SELECTION;
            break;
    }
}

async function handleViewOwnedTickets(messageObj) {
    try {
        const telegramId = messageObj.chat.id.toString();
        const context = getUserContext(telegramId);
        
        // Get total tickets count
        const countResult = await db.query(
            "SELECT COUNT(*) as total FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = true",
            [telegramId]
        );
        const totalTickets = parseInt(countResult.rows[0].total);

        // Handle no tickets case
        if (totalTickets === 0) {
            context.state = STATES.SERVICE_SELECTION;
            return await sendMessage(messageObj,
                "❌ You don't have any paid tickets yet.",
                [['Back to Menu']]
            );
        }

        switch (messageObj.text) {
            case 'Back to Menu':
            case 'Cancel':
                context.ticketPage = 1;
                context.state = STATES.SERVICE_SELECTION;
                return await handleStart(messageObj);

            case 'Show QR Code':
                // Get current ticket
                const currentTicket = await db.query(
                    "SELECT * FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = true " +
                    "ORDER BY timestamp DESC OFFSET $2 LIMIT 1",
                    [telegramId, context.ticketPage - 1]
                );
                
                if (currentTicket.rows.length > 0) {
                    const ticket = currentTicket.rows[0];
                    await handleTicketQRCode(messageObj, ticket.transaction_id);
                }
                break;

            case 'Next':
                if (context.ticketPage < totalTickets) {
                    context.ticketPage++;
                    const result = await db.query(
                        "SELECT * FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = true " +
                        "ORDER BY timestamp DESC OFFSET $2 LIMIT 1",
                        [telegramId, context.ticketPage - 1]
                    );
                    if (result.rows.length > 0) {
                        const ticket = result.rows[0];
                        await displayTicketInfo(messageObj, ticket, context, totalTickets);
                    }
                }
                break;

            case 'Previous':
                if (context.ticketPage > 1) {
                    context.ticketPage--;
                    const result = await db.query(
                        "SELECT * FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = true " +
                        "ORDER BY timestamp DESC OFFSET $2 LIMIT 1",
                        [telegramId, context.ticketPage - 1]
                    );
                    if (result.rows.length > 0) {
                        const ticket = result.rows[0];
                        await displayTicketInfo(messageObj, ticket, context, totalTickets);
                    }
                }
                break;

            default:
                // Initial load or other button press - show current page
                const result = await db.query(
                    "SELECT * FROM euf_transactions WHERE telegram_id = $1 AND payment_confirmed = true " +
                    "ORDER BY timestamp DESC OFFSET $2 LIMIT 1",
                    [telegramId, context.ticketPage - 1]
                );

                if (result.rows.length > 0) {
                    const ticket = result.rows[0];
                    await displayTicketInfo(messageObj, ticket, context, totalTickets);
                }
                break;
        }

        console.log('View Tickets - Current state:', {
            text: messageObj.text,
            currentPage: context.ticketPage,
            state: context.state
        });
    } catch (error) {
        console.error('Error in handleViewOwnedTickets:', error);
        const context = getUserContext(messageObj.chat.id);
        context.ticketPage = 1;
        context.state = STATES.SERVICE_SELECTION;
        await sendMessage(messageObj,
            "Sorry, there was an error viewing your tickets. Please try again.",
            [['Back to Menu']]
        );
    }
}

// Handle QR code generation
async function handleTicketQRCode(messageObj, transactionId) {
    try {
        // Send status message
        await sendMessage(messageObj, "✨ Generating QR code for your ticket...");
        
        // Generate QR code
        QRCode.toFile('qr-code.png', transactionId, { 
            type: 'png', 
            scale: 15, 
            margin: 2 
        }, async (err) => {
            if (!err) {
                // Success case
                setTimeout(async () => {
                    // Send the QR code
                    const formData = new FormData();
                    formData.append('chat_id', messageObj.chat.id);
                    formData.append('caption', `🎫 Transaction ID: ${transactionId}\n\nScan this QR code to verify your ticket.`);
                    formData.append('photo', fs.createReadStream('qr-code.png'));

                    await axios.post(
                        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
                        formData,
                        {
                            headers: {
                                ...formData.getHeaders()
                            }
                        }
                    );

                    // Clean up
                    fs.unlinkSync('qr-code.png');

                    // Send navigation message after delay
                    setTimeout(async () => {
                        await sendMessage(messageObj,
                            "Here's your ticket QR code! Use it for quick verification.",
                            [['Back to Tickets']]
                        );
                    }, 2000);
                }, 2000);
            } else {
                // Error case
                console.error('Error generating QR code:', err);
                await sendMessage(messageObj,
                    "Sorry, there was an error generating the QR code. Please try again.",
                    [['Back to Tickets'], ['Back to Menu']]
                );
            }
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        await sendMessage(messageObj,
            "Sorry, there was an error generating the QR code. Please try again.",
            [['Back to Tickets'], ['Back to Menu']]
        );
    }
}

// Handle displaying ticket information
async function displayTicketInfo(messageObj, ticket, context, totalTickets) {
    let message = `🎫 Your EUF Ticket (${context.ticketPage} of ${totalTickets})\n\n` +
                 `🏝️ Destination: ${ticket.destination}\n` +
                 `💰 Amount: PHP ${ticket.price}\n` +
                 `📅 Date: ${formatDate(ticket.created)}\n` +
                 `🔑 Transaction ID: ${ticket.transaction_id}`;

    // Build navigation keyboard
    let keyboard = [];
    
    // Navigation row
    let navRow = [];
    if (context.ticketPage > 1) {
        navRow.push('Previous');
    }
    if (context.ticketPage < totalTickets) {
        navRow.push('Next');
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    // Add Show QR Code button
    keyboard.push(['Show QR Code']);
    keyboard.push(['Back to Menu']);

    await sendMessage(messageObj, message, keyboard);
}

async function handleTransactionValidation(messageObj) {
    const transactionId = messageObj.text;
    
    // Check if user clicked "Back to Menu" or "Cancel"
    if (transactionId === 'Back to Menu' || transactionId === 'Cancel') {
        const context = getUserContext(messageObj.chat.id);
        context.state = STATES.SERVICE_SELECTION;
        return await handleStart(messageObj);
    }
    
    // Check transaction in database
    const result = await db.query(
        "SELECT * FROM euf_transactions WHERE transaction_id = $1",
        [transactionId]
    );
    
    if (result.rows.length === 0) {
        await sendMessage(messageObj,
            "❌ Transaction not found. Please check the ID and try again.",
            [['Cancel']]
        );
        return;
    }

    const transaction = result.rows[0];
    
    // Update verification count
    await db.query(
        "UPDATE euf_transactions SET verification_count = verification_count + 1 WHERE transaction_id = $1",
        [transactionId]
    );
    
    await sendMessage(messageObj,
        `✅ Transaction Found and Verified\n\n` +
        `🏝️ Destination: ${transaction.destination}\n` +
        `💰 Amount: PHP ${transaction.amount}\n` +
        `📅 Date: ${formatDate(transaction.created)}\n` +
        `🔑 Transaction ID: ${transaction.transaction_id}\n` +
        `🔍 Times Verified: ${transaction.verification_count + 1}`,
        [['Back to Menu']]
    );
}

// Helper function
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    });
}

async function handlePaymentConfirmation(messageObj) {
    const choice = messageObj.text;
    const context = getUserContext(messageObj.chat.id);
    
    switch (choice) {
        case 'Proceed to payment':
            try {
                const chatId = messageObj.chat.id.toString();
                const transactionId = uuidv4().replace(/-/g, '');
                const timestamp = new Date().toISOString();
                const amountCents = Math.round(context.destination.price * 100);

                // Create PayMongo payment link
                const headers = {
                    "Authorization": `Basic ${process.env.ENCODED_API_KEY}`,
                    "Content-Type": "application/json"
                };

                const payload = {
                    data: {
                        attributes: {
                            amount: amountCents,
                            description: `EUF Payment for ${context.destination.name}`,
                            remarks: `Transaction ID: ${transactionId}`,
                            currency: "PHP"
                        }
                    }
                };

                const response = await axios.post(
                    "https://api.paymongo.com/v1/links",
                    payload,
                    { headers }
                );

                if (response.status === 200 || response.status === 201) {
                    const paymentUrl = response.data.data.attributes.checkout_url;
                    const paymentId = response.data.data.id;

                    await db.query(
                        `INSERT INTO euf_transactions 
                        (id, transaction_id, telegram_id, destination, payment_confirmed, timestamp, price, paymongo_payment_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            `trans_${uuidv4()}`,
                            transactionId,
                            chatId,
                            context.destination.name,
                            false,
                            timestamp,
                            context.destination.price,
                            paymentId
                        ]
                    );

                    // Send payment link message
                    await sendMessage(messageObj,
                        `💳 Click the link below to complete your payment:\n${paymentUrl}\n\n` +
                        `🔑 Transaction ID: ${transactionId}`,
                        [['Cancel']]
                    );

                    // Start polling for payment status
                    pollPaymongoPayment(messageObj, transactionId, paymentId);

                    context.destination = null;
                    context.price = null;
                    context.state = STATES.SERVICE_SELECTION;
                }
            } catch (error) {
                console.error("Payment Error:", error);
                await sendMessage(messageObj,
                    "❌ Error creating payment link. Please try again later."
                );
                context.state = STATES.SERVICE_SELECTION;
                return await handleStart(messageObj);
            }
            break;

        case 'Change Destination':
            context.state = STATES.DESTINATION_SELECTION;
            return await handleDestinationSelection(messageObj);

        case 'Cancel':
            context.state = STATES.SERVICE_SELECTION;
            return await handleStart(messageObj);
    }
}

async function pollPaymongoPayment(messageObj, transactionId, paymentId) {
    const headers = {
        "Authorization": `Basic ${process.env.ENCODED_API_KEY}`,
        "Content-Type": "application/json"
    };

    const maxChecks = 120; // 60 minutes total polling (120 checks * 30 seconds)
    const checkInterval = 30000; // 30 seconds

    for (let i = 0; i < maxChecks; i++) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));

        try {
            const response = await axios.get(
                `https://api.paymongo.com/v1/links/${paymentId}`,
                { headers }
            );

            const status = response.data.data.attributes.status;

            if (status === "paid") {
                // Update transaction status
                await db.query(
                    "UPDATE euf_transactions SET payment_confirmed = true WHERE transaction_id = $1",
                    [transactionId]
                );

                const successMessage = 
                    `✅ EUF Payment Successful\n\n` +
                    `🏝️ Destination: ${response.data.data.attributes.description.replace('EUF Payment for ', '')}\n` +
                    `💰 Amount: PHP ${response.data.data.attributes.amount/100}\n` +
                    `📅 Date: ${new Date().toLocaleString()}\n` +
                    `🔑 Transaction ID: ${transactionId}\n\n` +
                    `✅ You are now free to explore!`;

                await sendMessage(messageObj, successMessage, [['Back to Menu']]);

                // Generate QR code for the transaction ID only after successful payment
                await handleTicketQRCode(messageObj, transactionId);

                // Reset user context to initial state
                const context = getUserContext(messageObj.chat.id);
                context.state = STATES.SERVICE_SELECTION;
                return;

            } else if (status === "expired" || status === "failed") {
                await sendMessage(messageObj,
                    `❌ Transaction ${transactionId} payment has failed or expired. ` +
                    "Please create a new transaction and try again."
                );
                return;
            }
        } catch (error) {
            console.error("Payment status check error:", error);
        }
    }

    // If polling ends without payment completion
    await sendMessage(messageObj,
        `⏳ Payment verification for transaction ${transactionId} timed out (1 hour passed). ` +
        "Please create a new transaction as the payment link has expired."
    );
}

async function handleTestPayment(messageObj) {
    const context = getUserContext(messageObj.chat.id);
    context.state = STATES.DESTINATION_SELECTION;
    return await handleDestinationSelection(messageObj);
}

async function handleQRCodeTest(messageObj) {
    const context = getUserContext(messageObj.chat.id);
    context.state = STATES.DESTINATION_SELECTION;
    return await handleDestinationSelection(messageObj);
}

async function handlePaymentMethod(messageObj, method) {
    const context = getUserContext(messageObj.chat.id);
    context.paymentMethod = method;
    context.state = STATES.DESTINATION_SELECTION;
    return await handleDestinationSelection(messageObj);
}

async function archivePaymongoLink(paymentId) {
    // Implementation of archivePaymongoLink function
}

module.exports = {
    handleMessage
};