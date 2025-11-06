"use strict";

// Dependencies
const {
        Client,
        Intents,
        MessageEmbed,
        MessageButton,
        MessageActionRow,
} = require("discord.js");
const fs = require("fs");

// Load config
const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

const bot = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

var usersInQueue = [];
var queue;
var activeTesterIds = []; // New array to store multiple tester IDs

// Function to register all commands
async function registerCommands(guild) {
        return await guild.commands.set([
                {
                        name: "queue",
                        description: "Make queue.",
                },
                {
                        name: "stopqueue",
                        description: "Deletes queue.",
                },
                {
                        name: "remove",
                        description: "Removes a user from queue.",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description: "User to remove in queue.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "rank",
                        description: "Set a rank to the specified user.",
                        options: [
                                {
                                        type: "STRING",
                                        name: "user",
                                        description: "User to give a rank.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "rank",
                                        description:
                                                "The rank to give to the user.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "result",
                        description: "Send test result.",
                        options: [
                                {
                                        type: "USER",
                                        name: "user",
                                        description:
                                                "The user who took the test.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "region",
                                        description: "The region of the user.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "username",
                                        description:
                                                "The username of the user.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "previous_rank",
                                        description:
                                                "The previous rank of the user.",
                                        required: true,
                                },
                                {
                                        type: "STRING",
                                        name: "rank_earned",
                                        description:
                                                "The rank earned by the user.",
                                        required: true,
                                },
                        ],
                },
                {
                        name: "refresh",
                        description: "Refresh all slash commands.",
                },
                {
                        name: "jointester",
                        description: "Join as an active tester.",
                },
        ]);
}

// Add these functions after the existing dependencies
async function createTicket(guild, user, tester) {
        const ticketChannel = await guild.channels.create(
                `ticket-${user.username}`,
                {
                        type: "GUILD_TEXT",
                        permissionOverwrites: [
                                {
                                        id: guild.id,
                                        deny: ["VIEW_CHANNEL"],
                                },
                                {
                                        id: user.id,
                                        allow: [
                                                "VIEW_CHANNEL",
                                                "SEND_MESSAGES",
                                        ],
                                },
                                {
                                        id: tester,
                                        allow: [
                                                "VIEW_CHANNEL",
                                                "SEND_MESSAGES",
                                        ],
                                },
                        ],
                },
        );

        const closeButton = new MessageActionRow().addComponents(
                new MessageButton()
                        .setCustomId("closeTicket")
                        .setLabel("Close Ticket")
                        .setStyle("DANGER"),
        );

        const embed = new MessageEmbed()
                .setTitle("Test Ticket")
                .setDescription(`Welcome <@${user.id}>!\nTester: <@${tester}>`);

        await ticketChannel.send({
                embeds: [embed],
                components: [closeButton],
        });
        return ticketChannel;
}

// Main
bot.on("ready", async () => {
        console.log("PvP Tierlist is running.");

        bot.user.setPresence({
                activities: [
                        {
                                name: "LUMINOUSITY TIERLIST",
                                type: "WATCHING",
                        },
                ],
                status: "online",
        });

        const guild = bot.guilds.cache.first();
        if (guild) {
                await registerCommands(guild);
        } else {
                console.error("No guilds found for the bot.");
        }

        setInterval(async () => {
                if (queue) {
                        // Check if there are users in queue and active testers
                        if (
                                usersInQueue.length > 0 &&
                                activeTesterIds.length > 0
                        ) {
                                // Get the first user in queue
                                const user = bot.users.cache.get(
                                        usersInQueue[0],
                                );
                                if (user) {
                                        // Get all ticket channels
                                        const ticketChannels =
                                                queue.guild.channels.cache.filter(
                                                        (c) =>
                                                                c.name.startsWith(
                                                                        `ticket-`,
                                                                ) &&
                                                                c.type ===
                                                                        "GUILD_TEXT",
                                                );

                                        // Only create a new ticket if there are no existing tickets
                                        if (ticketChannels.size === 0) {
                                                try {
                                                        // Create ticket with first available tester
                                                        await createTicket(
                                                                queue.guild,
                                                                user,
                                                                activeTesterIds[0],
                                                        );
                                                        // Remove user from queue after ticket creation
                                                        usersInQueue.shift();
                                                } catch (error) {
                                                        console.error(
                                                                "Error creating ticket:",
                                                                error,
                                                        );
                                                }
                                        }
                                }
                        }

                        // Update queue embed
                        const embed = new MessageEmbed().setTitle(
                                "Tester(s) Available!",
                        ).setDescription(`The queue updates every 10 seconds.

**Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

**Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                        try {
                                await queue.edit({ embeds: [embed] });
                        } catch (err) {
                                console.error(
                                        "Failed to update queue message:",
                                        err,
                                );
                        }
                }
        }, 10 * 1000);
});

function hasPermission(member) {
        return (
                member.roles.cache.some((r) => r.id === config.roleID) ||
                member.roles.cache.some((r) => r.id === config.ownerRoleID)
        );
}

// Modify the interactionCreate event for slash commands
bot.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return;

        if (!hasPermission(interaction.member)) {
                return interaction.reply({
                        content: "You do not have permission to use this command.",
                        ephemeral: true,
                });
        }

        const { commandName } = interaction;

        switch (commandName) {
                case "queue":
                        if (
                                !interaction.member.roles.cache.some(
                                        (r) => r.id === config.roleID,
                                )
                        ) {
                                return interaction.reply({
                                        content: "You do not have the required role.",
                                        ephemeral: true,
                                });
                        }

                        // Reset and initialize active testers with the queue creator
                        activeTesterIds = [interaction.user.id];

                        const button = new MessageActionRow().addComponents(
                                new MessageButton()
                                        .setCustomId("joinQueue")
                                        .setLabel("Join Queue")
                                        .setStyle("PRIMARY"),
                        );

                        const embed = new MessageEmbed().setTitle(
                                "Tester(s) Available!",
                        ).setDescription(`The queue updates every 10 seconds.

 **Queue**:

 **Active Testers**:
 ${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                        const channel = interaction.guild.channels.cache.get(
                                config.channelID,
                        );
                        if (!channel) {
                                return interaction.reply({
                                        content: "Channel not found.",
                                        ephemeral: true,
                                });
                        }

                        queue = await channel.send({
                                embeds: [embed],
                                components: [button],
                        });
                        await interaction.reply({
                                content: "Queue created successfully.",
                                ephemeral: true,
                        });
                        break;
                case "jointester":
                        if (!queue) {
                                return interaction.reply({
                                        content: "There is no active queue.",
                                        ephemeral: true,
                                });
                        }

                        if (
                                !interaction.member.roles.cache.some(
                                        (r) => r.id === config.roleID,
                                )
                        ) {
                                return interaction.reply({
                                        content: "You do not have the required role.",
                                        ephemeral: true,
                                });
                        }

                        if (activeTesterIds.includes(interaction.user.id)) {
                                return interaction.reply({
                                        content: "You are already an active tester.",
                                        ephemeral: true,
                                });
                        }

                        activeTesterIds.push(interaction.user.id);

                        // update queue embed
                        try {
                                const newEmbed = new MessageEmbed().setTitle(
                                        "Tester(s) Available!",
                                )
                                        .setDescription(`The queue updates every 10 seconds.

 **Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

 **Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                                await queue.edit({ embeds: [newEmbed] });
                        } catch (err) {
                                console.error(
                                        "Failed to edit queue message:",
                                        err,
                                );
                        }

                        await interaction.reply({
                                content: "You have been added as an active tester.",
                                ephemeral: true,
                        });
                        break;
                // ... other command cases ...
        }
});

bot.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === "closeTicket") {
                const member = interaction.member;
                const hasPermission =
                        member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) || member.permissions.has("ADMINISTRATOR");

                if (!hasPermission) {
                        return interaction.reply({
                                content: "You do not have permission to close this ticket.",
                                ephemeral: true,
                        });
                }

                await interaction.reply({
                        content: "🔒 Closing ticket in 5 seconds...",
                        ephemeral: false,
                });

                setTimeout(async () => {
                        try {
                                await interaction.channel.delete();
                        } catch (error) {
                                console.error(
                                        "Error deleting ticket channel:",
                                        error,
                                );
                        }
                }, 5000);
        }

        if (interaction.customId === "joinQueue") {
                if (usersInQueue.includes(interaction.user.id)) {
                        await interaction.reply({
                                content: "You are already in the queue.",
                                ephemeral: true,
                        });
                } else {
                        usersInQueue.push(interaction.user.id);
                        await interaction.reply({
                                content: "You have successfully joined the queue.",
                                ephemeral: true,
                        });
                }
        }
});

bot.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith(config.prefix)) return;

        const args = message.content
                .slice(config.prefix.length)
                .trim()
                .split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === "help") {
                const embed = new MessageEmbed()
                        .setTitle("Bot Commands")
                        .setDescription(
                                `Prefix: \`${config.prefix}\`\n\nAvailable Commands:`,
                        )
                        .addField(
                                `${config.prefix}queue`,
                                "Create a queue (Tester role required)",
                                false,
                        )
                        .addField(
                                `${config.prefix}stopqueue`,
                                "Delete the queue (Tester/Admin)",
                                false,
                        )
                        .addField(
                                `${config.prefix}remove <user>`,
                                "Remove a user from queue (Tester/Admin)",
                                false,
                        )
                        .addField(
                                `${config.prefix}rank <user> <role>`,
                                "Assign a rank to a user (Tester/Admin)",
                                false,
                        )
                        .addField(
                                `${config.prefix}result <@user> <region> <username> <prev_rank> <rank_earned>`,
                                "Send test results (Tester/Admin)",
                                false,
                        )
                        .addField(
                                `${config.prefix}refresh`,
                                "Refresh slash commands (Admin only)",
                                false,
                        )
                        .addField(
                                `${config.prefix}help`,
                                "Show this help message",
                                false,
                        )
                        .addField(
                                `${config.prefix}jointester`,
                                "Join as an active tester (Tester role required)",
                                false,
                        )
                        .setColor("#0099ff");

                return message.reply({ embeds: [embed] });
        }

        if (command === "queue") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        )
                ) {
                        return message.reply(
                                "You do not have the required role.",
                        );
                }

                // Reset and initialize active testers with the queue creator
                activeTesterIds = [message.author.id];

                const button = new MessageActionRow().addComponents(
                        new MessageButton()
                                .setCustomId("joinQueue")
                                .setLabel("Join Queue")
                                .setStyle("PRIMARY"),
                );

                const embed = new MessageEmbed().setTitle(
                        "Tester(s) Available!",
                ).setDescription(`The queue updates every 10 seconds.

 **Queue**:

 **Active Testers**:
 ${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                const channel = message.guild.channels.cache.get(
                        config.channelID,
                );
                if (!channel) {
                        return message.reply("Channel not found.");
                }

                queue = await channel.send({
                        embeds: [embed],
                        components: [button],
                });
                return message.reply("Queue created successfully.");
        }

        if (command === "stopqueue") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (!queue) {
                        return message.reply("No active queue to be deleted.");
                }

                usersInQueue = [];
                activeTesterIds = [];
                try {
                        await queue.delete();
                } catch (e) {
                        console.error("Failed to delete queue message:", e);
                }
                queue = null;

                return message.reply("Queue successfully deleted.");
        }

        if (command === "remove") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length === 0) {
                        return message.reply(
                                "Please provide a user to remove.",
                        );
                }

                let user = args[0];
                const userIdMatch = user.match(/\d+/);

                if (userIdMatch) {
                        user = userIdMatch[0];

                        if (usersInQueue.includes(user)) {
                                usersInQueue = usersInQueue.filter(
                                        (u) => u !== user,
                                );
                                return message.reply(
                                        "User successfully removed from the queue.",
                                );
                        } else {
                                return message.reply(
                                        "User is not in the queue.",
                                );
                        }
                } else {
                        return message.reply("Invalid user ID.");
                }
        }

        if (command === "rank") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length < 2) {
                        return message.reply(
                                "Please provide a user and a role.",
                        );
                }

                let user = args[0];
                let rank = args[1];

                const userIdMatch = user.match(/\d+/);
                const rankIdMatch = rank.match(/\d+/);

                if (userIdMatch && rankIdMatch) {
                        user = message.guild.members.cache.get(userIdMatch[0]);
                        rank = message.guild.roles.cache.find(
                                (r) => r.id === rankIdMatch[0],
                        );

                        if (!user || !rank) {
                                return message.reply(
                                        "Please mention a valid user and role.",
                                );
                        }

                        user.roles.add(rank);
                        return message.reply("Rank assigned successfully.");
                } else {
                        return message.reply("Invalid user or role ID.");
                }
        }

        if (command === "result") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        ) &&
                        !message.member.permissions.has("ADMINISTRATOR")
                ) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                if (args.length < 5) {
                        return message.reply(
                                `Usage: ${config.prefix}result <@user> <region> <username> <previous_rank> <rank_earned>`,
                        );
                }

                const userMatch = args[0].match(/\d+/);
                if (!userMatch) {
                        return message.reply("Please mention a valid user.");
                }

                const user = await message.guild.members.fetch(userMatch[0]);
                if (!user) {
                        return message.reply("User not found.");
                }

                const region = args[1];
                const username = args[2];
                const previousRank = args[3];
                const rankEarned = args.slice(4).join(" ");

                const avatarUrl = `https://minotar.net/avatar/${username}`;

                const embed = new MessageEmbed()
                        .setTitle(`${user.user.username}'s Test Results 🏆`)
                        .setThumbnail(avatarUrl)
                        .setColor("#8B0000")
                        .addField("Tester:", `<@${message.author.id}>`, false)
                        .addField("Region:", region, false)
                        .addField("Username:", username, false)
                        .addField("Previous Rank:", previousRank, false)
                        .addField("Rank Earned:", rankEarned, false);

                return message.channel.send({
                        content: `<@${user.id}>`,
                        embeds: [embed],
                });
        }

        if (command === "refresh") {
                if (!message.member.permissions.has("ADMINISTRATOR")) {
                        return message.reply(
                                "You do not have the required permissions.",
                        );
                }

                const msg = await message.reply("Refreshing commands...");

                try {
                        await registerCommands(message.guild);
                        return msg.edit("Commands refreshed successfully!");
                } catch (error) {
                        console.error(error);
                        return msg.edit(
                                "Failed to refresh commands. Check console for errors.",
                        );
                }
        }

        if (command === "jointester") {
                if (
                        !message.member.roles.cache.some(
                                (r) => r.id === config.roleID,
                        )
                ) {
                        return message.reply(
                                "You do not have the required role.",
                        );
                }

                if (!queue) {
                        return message.reply("There is no active queue.");
                }

                // Check if tester is already active
                if (activeTesterIds.includes(message.author.id)) {
                        return message.reply(
                                "You are already an active tester.",
                        );
                }

                // Add the new tester to the array
                activeTesterIds.push(message.author.id);

                // Update the queue embed
                const embed = new MessageEmbed().setTitle(
                        "Tester(s) Available!",
                ).setDescription(`The queue updates every 10 seconds.

**Queue**:
${usersInQueue.map((user, index) => `${index + 1}. <@${user}>`).join("\n")}

**Active Testers**:
${activeTesterIds.map((testerId) => `<@${testerId}>`).join("\n")}`);

                queue.edit({ embeds: [embed] });
                return message.reply(
                        "You have been added as an active tester.",
                );
        }
});

bot.login(config.token);
