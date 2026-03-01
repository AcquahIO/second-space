import OpenAI from "openai";
export class OpenAIAdapter {
    id;
    name;
    provider = "openai";
    executionMode = "REAL";
    client;
    model;
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.model = options.model ?? "gpt-4.1-mini";
        this.client = new OpenAI({ apiKey: options.apiKey });
    }
    async execute(input) {
        try {
            const response = await this.client.responses.create({
                model: this.model,
                input: [
                    {
                        role: "system",
                        content: "You are a specialist worker agent executing an assigned business task. Return concise completion output."
                    },
                    {
                        role: "user",
                        content: input.prompt
                    }
                ]
            });
            return {
                ok: true,
                output: response.output_text,
                raw: response
            };
        }
        catch (error) {
            return {
                ok: false,
                output: "",
                error: error instanceof Error ? error.message : "Unknown OpenAI adapter error"
            };
        }
    }
}
