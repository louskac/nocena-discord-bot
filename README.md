# Nocena Discord Quiz Bot

A Discord bot that administers quizzes based on the Nocena whitepaper, generating invite codes for users who successfully complete them.

## About

The Nocena Discord Quiz Bot engages users by testing their knowledge of the Nocena platform through an interactive quiz flow. Users who complete the quiz earn exclusive invite codes they can use to register on the Nocena app.

### Features

- Interactive quiz with multiple-choice questions about Nocena
- Open-ended questions that gather user input
- Channel-specific commands
- Invite code generation
- Integration with Dgraph database
- Persistent data storage

## Setup

### Prerequisites

- Node.js (v16.x or higher)
- npm or pnpm
- A Discord application with bot credentials
- A Dgraph database

### Installation

1. Clone this repository
  git clone https://github.com/yourusername/nocena-discord-bot.git
  cd nocena-discord-bot

2. Install dependencies
  npm install

3. Create a `.env` file in the root directory with the following variables:
  DISCORD_TOKEN=your_discord_bot_token
  DISCORD_CLIENT_ID=your_discord_application_id
  DGRAPH_ENDPOINT=your_dgraph_endpoint
  DGRAPH_API_KEY=your_dgraph_api_key

### Dgraph Schema

Add the following schema to your Dgraph database:

```graphql
# Discord quiz invites
type DiscordInvite {
id: String! @id
code: String! @search(by: [exact])
discordUserId: String! @search(by: [exact])
discordUsername: String
isUsed: Boolean! @search
userId: String @search(by: [exact])
createdAt: DateTime
usedAt: DateTime
quizScore: Int
openResponses: [QuizResponse] @hasInverse(field: "discordInvite")
}

# Store open-ended quiz responses
type QuizResponse {
id: String! @id
discordInvite: DiscordInvite! @hasInverse(field: "openResponses")
questionType: String! @search(by: [exact])
response: String
}
```

## Usage

### Running Locally

To run the bot locally:
  node index.js

### Commands

- `/startquiz` - Begins the quiz process for the user
- `/help` - Displays information about the bot

### Quiz Flow

1. User enters the first open-ended question
2. User answers 5 multiple-choice questions about Nocena
3. User provides a challenge idea as the final question
4. Bot generates and provides a unique invite code

## Deployment

### Render.com

This project includes a `render.yaml` file for easy deployment to Render:

1. Push your code to GitHub
2. Connect your GitHub repository to Render
3. Add your environment variables in the Render dashboard
4. Deploy the service

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
