import { PermissionsString, ApplicationCommandType, ChatInputApplicationCommandData, MessageApplicationCommandData, UserApplicationCommandData, ClientEvents, ChatInputCommandInteraction, UserContextMenuCommandInteraction, MessageContextMenuCommandInteraction, AutocompleteInteraction, Message } from 'discord.js';
import { CustomClient } from '../functions/customClient.js';

interface EventData<EventName extends keyof ClientEvents> {
  name: string; event: EventName; once?: boolean; execute(_client?: CustomClient, ...args: ClientEvents[EventName]): Promise<void>;
}

export type Event = { [Key in keyof ClientEvents]: EventData<Key> }[keyof ClientEvents];

interface AdditionalOptions {
  botPermissions?: PermissionsString | PermissionsString[]; userPermissions?: PermissionsString | PermissionsString[]; devOnly?: boolean;
  /* global?: boolean */
}

type ApplicationCommandData<T extends ApplicationCommandType> = T extends ApplicationCommandType.ChatInput ? ChatInputApplicationCommandData & { execute(client: CustomClient, interaction: ChatInputCommandInteraction): Promise<void>; autocomplete?(client: CustomClient, interaction: AutocompleteInteraction): Promise<void>; } : T extends ApplicationCommandType.Message ? MessageApplicationCommandData & { execute(client: CustomClient, interaction: MessageContextMenuCommandInteraction): Promise<void>; } : T extends ApplicationCommandType.User ? UserApplicationCommandData & { execute(client: CustomClient, interaction: UserContextMenuCommandInteraction): Promise<void>; } : never;

export type SlashCommand = ApplicationCommandData<ApplicationCommandType> & AdditionalOptions;

type MessageCommandData = {
  alias: string[];
  desc?: string;
  execute: (client: CustomClient, message: Message, args: string[]) => Promise<any>;
};

export type MessageCommand = MessageCommandData & AdditionalOptions;
