const { SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, 
  ButtonStyle, EmbedBuilder, ModalBuilder, 
  TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// Dgraph API endpoints - replace with your actual endpoints
const DGRAPH_ENDPOINT = process.env.DGRAPH_ENDPOINT;
const DGRAPH_API_KEY = process.env.DGRAPH_API_KEY;

// Quiz questions
const quizQuestions = [
{
  question: "According to the whitepaper, which of these is a key feature that differentiates Nocena from traditional social media platforms?",
  options: [
    "Unlimited content posting",
    "Token rewards for completing challenges",
    "Anonymous profiles",
    "AI-driven content moderation"
  ],
  correctAnswer: 1
},
{
  question: "According to the Nocena whitepaper, what major problem exists with traditional social media platforms?",
  options: [
    "They're too expensive for users",
    "They lack sufficient content moderation",
    "They prioritize passive scrolling over meaningful engagement",
    "They don't offer enough features"
  ],
  correctAnswer: 2
},
{
  question: "How often are new AI-generated challenges provided on Nocena?",
  options: [
    "Hourly",
    "Daily, weekly, and monthly",
    "Only on weekends",
    "Annually"
  ],
  correctAnswer: 1
},
{
  question: "What technology does Nocena use to store images?",
  options: [
    "AWS S3",
    "Google Cloud Storage",
    "Pinata (IPFS)",
    "Local file storage"
  ],
  correctAnswer: 2
},
{
  question: "What can businesses create on the Nocena map?",
  options: [
    "NFT collections",
    "Advertisements",
    "Location-based challenges",
    "Virtual events"
  ],
  correctAnswer: 2
}
];

// User sessions map to track quiz progress
const userSessions = new Map();

// Register slash commands
async function registerCommands(client) {
try {
  const commands = [
    new SlashCommandBuilder()
      .setName('startquiz')
      .setDescription('Start the Nocena whitepaper quiz to get an invite code'),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Get information about the Nocena quiz bot')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log('Started refreshing application (/) commands.');

  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
    { body: commands.map(command => command.toJSON()) }
  );

  console.log('Successfully registered application commands.');
} catch (error) {
  console.error('Error registering commands:', error);
}
}

// Check if user already has an invite code
async function checkUserHasInviteCode(discordUserId) {
  try {
    // GraphQL query to check for existing invite codes
    const query = `
      query {
        queryDiscordInvite(filter: {discordUserId: {eq: "${discordUserId}"}}) {
          id
          code
          isUsed
        }
      }
    `;

    const response = await axios.post(DGRAPH_ENDPOINT, { query }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': DGRAPH_API_KEY
      }
    });

    if (response.data.data.queryDiscordInvite.length > 0) {
      return {
        hasCode: true,
        code: response.data.data.queryDiscordInvite[0].code,
        isUsed: response.data.data.queryDiscordInvite[0].isUsed
      };
    }

    return { hasCode: false };
  } catch (error) {
    console.error('Error checking for existing invite code:', error);
    // Still allow quiz to proceed if there's an error
    return { hasCode: false, error: true };
  }
}

// Generate a random 6-character invite code
function generateInviteCode() {
const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
let code = '';
for (let i = 0; i < 6; i++) {
  code += characters.charAt(Math.floor(Math.random() * characters.length));
}
return code;
}

// Save invite code to Dgraph
async function saveInviteCode(data) {
  try {
    const now = new Date().toISOString();

    // Log what we're saving
    console.log(`Saving invite code ${data.code} for user ${data.discordUserId} to database`);

    // GraphQL mutation to add a new invite code
    const mutation = `
      mutation {
        addDiscordInvite(input: [{
          id: "${data.id}",
          code: "${data.code}",
          discordUserId: "${data.discordUserId}",
          discordUsername: "${data.discordUsername}",
          isUsed: false,
          createdAt: "${now}",
          quizScore: ${data.quizScore}
        }]) {
          discordInvite {
            id
            code
          }
        }
      }
    `;

    // Execute the main invite code mutation
    const response = await axios.post(DGRAPH_ENDPOINT, { query: mutation }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': DGRAPH_API_KEY
      }
    });

    // Log response
    console.log('Dgraph response:', JSON.stringify(response.data, null, 2));

    // For each open response, create a separate record
    for (const openResponse of data.openResponses) {
      const responseMutation = {
        query: `
          mutation {
            addQuizResponse(input: [{
              id: "${openResponse.id}",
              questionType: "${openResponse.questionType}",
              response: "${openResponse.response.replace(/"/g, '\\"')}",
              discordInvite: { id: "${data.id}" }
            }]) {
              quizResponse {
                id
              }
            }
          }
        `
      };

      await axios.post(DGRAPH_ENDPOINT, responseMutation, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': DGRAPH_API_KEY
        }
      });
    }

    return response.data;
  } catch (error) {
    console.error('Error saving invite code:', error);
    console.error('Error details:', error.response?.data || 'No response data');
    // Still generate the code even if saving fails
    return { success: false, error: true };
  }
}

// Handle command interactions
async function handleCommands(interaction) {
  try {
    // Check if the command is used in the correct channel
    if (interaction.channel.name !== 'invite-codes') {
      return interaction.reply({ 
        content: 'This command can only be used in the #invite-codes channel!', 
        ephemeral: true 
      });
    }
    
    if (interaction.commandName === 'startquiz') {
      await handleStartQuiz(interaction);
    } else if (interaction.commandName === 'help') {
      await handleHelp(interaction);
    }
  } catch (error) {
    console.error('Error handling command:', error);
    
    // If we haven't replied to the interaction yet, send an error response
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'Sorry, something went wrong processing your command. Please try again later.', 
        ephemeral: true 
      });
    }
  }
}

// Handle button interactions
async function handleButtons(interaction) {
  // Check if the interaction is in the correct channel
  if (interaction.channel.name !== 'invite-codes') {
    return interaction.reply({ 
      content: 'Quiz interactions can only be used in the #invite-codes channel!', 
      ephemeral: true 
    });
  }

  // Handle the final question button
  if (interaction.customId === 'show-final-modal') {
    // Create the modal for the final open-ended question
    const modal = new ModalBuilder()
      .setCustomId('finalQuestionModal')
      .setTitle('One Last Question');

    // Add text input component
    const questionInput = new TextInputBuilder()
      .setCustomId('finalResponse')
      .setLabel('Come up with a challenge for other users')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(10)
      .setMaxLength(1000)
      .setPlaceholder('What challenge would you give to others?')
      .setRequired(true);

    // Add the input to the modal
    const actionRow = new ActionRowBuilder().addComponents(questionInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
    return;
  }
  
  // Handle quiz answer buttons
  const [action, questionNumber, selectedOption] = interaction.customId.split('-');
  
  if (action === 'answer') {
    await handleQuizAnswer(interaction, parseInt(questionNumber), parseInt(selectedOption));
  } else if (action === 'restart') {
    await handleStartQuiz(interaction);
  }
}

// Handle modal submissions
async function handleModals(interaction) {
// We can't check the channel for modals directly
// But we can check if the user has an active session
if (!userSessions.has(interaction.user.id)) {
  return interaction.reply({ 
    content: 'Your quiz session has expired. Please start a new quiz in the #invite-codes channel.', 
    ephemeral: true 
  });
}

if (interaction.customId === 'initialQuestionModal') {
  await handleInitialQuestion(interaction);
} else if (interaction.customId === 'finalQuestionModal') {
  await handleFinalQuestion(interaction);
}
}

// Handle the start quiz command
async function handleStartQuiz(interaction) {
// Check if user already has an invite code
const inviteStatus = await checkUserHasInviteCode(interaction.user.id);

if (inviteStatus.hasCode) {
  // User already has a code
  let message = `You've already completed the quiz! Your invite code is: \`${inviteStatus.code}\``;
  if (inviteStatus.isUsed) {
    message += "\n\nThis code has already been used to register an account.";
  }

  await interaction.reply({ content: message, ephemeral: true });
  return;
}

// Initialize a new session for the user
userSessions.set(interaction.user.id, {
  currentQuestion: -1, // Start with initial question
  correctAnswers: 0,
  openResponses: {}
});

// Create modal for initial question
const modal = new ModalBuilder()
  .setCustomId('initialQuestionModal')
  .setTitle('Get Started with Nocena');

const questionInput = new TextInputBuilder()
  .setCustomId('initialResponse')
  .setLabel('What is the craziest thing you have done?')
  .setStyle(TextInputStyle.Paragraph)
  .setMinLength(10)
  .setMaxLength(1000)
  .setPlaceholder('Tell us about a crazy experience...')
  .setRequired(true);

const firstActionRow = new ActionRowBuilder().addComponents(questionInput);
modal.addComponents(firstActionRow);

await interaction.showModal(modal);
}

// Handle the help command
async function handleHelp(interaction) {
const embed = new EmbedBuilder()
  .setColor('#0099ff')
  .setTitle('Nocena Quiz Bot - Help')
  .setDescription('This bot helps you earn an invite code to join the Nocena app.')
  .addFields(
    { name: 'How it works', value: 'Use `/startquiz` to begin a short quiz about the Nocena whitepaper. Answer 5 questions and share your challenge ideas to earn an exclusive invite code.' },
    { name: 'Whitepaper', value: 'Read the Nocena whitepaper at: https://www.nocena.com/assets/whitepaper-B2kZZbgT.pdf' },
    { name: 'Got Questions?', value: 'Join our community Discord for more information!' }
  )
  .setFooter({ text: 'Nocena - Challenge Yourself' });

await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Handle the response to the initial question
async function handleInitialQuestion(interaction) {
// Get user session
const session = userSessions.get(interaction.user.id);
if (!session) {
  await interaction.reply({ content: 'Your session has expired. Please start again with /startquiz', ephemeral: true });
  return;
}

// Store the response
session.openResponses.initial = interaction.fields.getTextInputValue('initialResponse');
session.currentQuestion = 0; // Move to the first multiple choice question

// Acknowledge the response
await interaction.reply({ content: 'Thanks for sharing! Now let\'s test your knowledge about Nocena.', ephemeral: true });

// Send the first multiple choice question
await sendQuestion(interaction, 0);
}

// Send a multiple choice question to the user
async function sendQuestion(interaction, questionNumber) {
const question = quizQuestions[questionNumber];

// Create an embed for the question
const embed = new EmbedBuilder()
  .setColor('#0099ff')
  .setTitle(`Question ${questionNumber + 1} of ${quizQuestions.length}`)
  .setDescription(question.question)
  .setFooter({ text: 'Answer correctly to get a Nocena invite code!' });

// Create buttons for each option
const row = new ActionRowBuilder();

question.options.forEach((option, index) => {
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`answer-${questionNumber}-${index}`)
      .setLabel(option)
      .setStyle(ButtonStyle.Primary)
  );
});

// Send the question
await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
}

// Handle a quiz answer
async function handleQuizAnswer(interaction, questionNumber, selectedOption) {
// Get the user's session
const session = userSessions.get(interaction.user.id);
if (!session) {
  await interaction.reply({ content: 'Your session has expired. Please start again with /startquiz', ephemeral: true });
  return;
}

// Check if the answer is correct
const question = quizQuestions[questionNumber];
const isCorrect = selectedOption === question.correctAnswer;

// Update the user's score
if (isCorrect) {
  session.correctAnswers++;
}

// Prepare feedback
let feedback;
if (isCorrect) {
  feedback = `✅ Correct! Great job.`;
} else {
  feedback = `❌ Incorrect. The correct answer was: ${question.options[question.correctAnswer]}`;
}

// Acknowledge the answer
await interaction.reply({ content: feedback, ephemeral: true });

// Move to the next question or finish
if (questionNumber < quizQuestions.length - 1) {
  // Move to the next question
  session.currentQuestion = questionNumber + 1;
  await sendQuestion(interaction, questionNumber + 1);
} else {
  // Show the final open-ended question
  await showFinalQuestion(interaction);
}
}

// Show the final open-ended question
async function showFinalQuestion(interaction) {
  try {
    // Instead of trying to show a modal after follow-up, create a button that will trigger the modal
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('show-final-modal')
          .setLabel('Answer Final Question')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.followUp({ 
      content: 'You\'ve completed all the multiple choice questions! Click the button below to answer the final question and get your invite code.', 
      components: [row],
      ephemeral: true 
    });
  } catch (error) {
    console.error('Error in showFinalQuestion:', error);
    await interaction.followUp({ 
      content: 'Sorry, there was an error with the final question. Please try running `/startquiz` again.', 
      ephemeral: true 
    });
  }
}

// Handle the response to the final question
async function handleFinalQuestion(interaction) {
// Get user session
const session = userSessions.get(interaction.user.id);
if (!session) {
  await interaction.reply({ content: 'Your session has expired. Please start again with /startquiz', ephemeral: true });
  return;
}

// Store the response
session.openResponses.challenge = interaction.fields.getTextInputValue('finalResponse');

// Generate and save the invite code
await generateAndSaveInviteCode(interaction, session);
}

// Generate and save the invite code
async function generateAndSaveInviteCode(interaction, session) {
try {
  // Generate a unique invite code
  const inviteCode = generateInviteCode();

  // Prepare data for saving
  const inviteData = {
    id: `discord-invite-${interaction.user.id}-${Date.now()}`,
    code: inviteCode,
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.tag,
    quizScore: session.correctAnswers,
    openResponses: [
      {
        id: `quiz-response-initial-${interaction.user.id}-${Date.now()}`,
        questionType: "initial",
        response: session.openResponses.initial
      },
      {
        id: `quiz-response-challenge-${interaction.user.id}-${Date.now()}`,
        questionType: "challenge",
        response: session.openResponses.challenge
      }
    ]
  };

  // Save to database
  await saveInviteCode(inviteData);

  // Send the invite code to the user
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎉 Congratulations! 🎉')
    .setDescription(`You've completed the Nocena quiz with ${session.correctAnswers} out of ${quizQuestions.length} correct answers!`)
    .addFields(
      { name: 'Your Exclusive Invite Code', value: `\`${inviteCode}\`` },
      { name: 'How to Use', value: 'Visit [Nocena.com](https://www.newapp.nocena.com) and enter this code during registration to join!' },
      { name: 'Invite Expires', value: 'This code is valid for 7 days and can only be used once.' }
    )
    .setFooter({ text: 'Welcome to Nocena - Challenge Yourself!' });

  await interaction.reply({ embeds: [embed], ephemeral: true });

  // Clear the user's session
  userSessions.delete(interaction.user.id);
} catch (error) {
  console.error('Error generating invite code:', error);

  await interaction.reply({ 
    content: 'Sorry, there was an error generating your invite code. Please try again later or contact support.',
    ephemeral: true 
  });
}
}

module.exports = {
registerCommands,
handleCommands,
handleButtons,
handleModals
};