# SW discord bot 

### To send messages to a discord server using a webhook there are a couple of things you need to do:

<br>

1. Create a webhook in your server by opening your server _**settings**_ -> _**integrations**_ -> _**webhooks**_;

 
2. Create your webhook & copy it's **URL**. From that URL you will need the webhook's **token** and **id**.

3. Send a **POST** request to `https://discord.com/api/webhooks/{webhoook.id}/{webhook.token}` using the *token* and *id* you just acquired.

<br>

You just sent a message!

For further info visit the [Webhook Docs](https://discord.com/developers/docs/resources/webhook#execute-webhook)