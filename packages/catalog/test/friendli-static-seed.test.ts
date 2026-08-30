import { describe, expect, it } from "bun:test";
import { buildModel } from "../src/build";
import { Effort } from "../src/effort";
import { resolveProviderModels } from "../src/model-manager";
import type { Model, ModelSpec } from "../src/types";

/**
 * Friendli's bundled surface is a curated static seed (no discovery), so the
 * provider must resolve end-to-end from the bundle alone: the picker shows the
 * model and chat requests carry the correct reasoning-effort dialect.
 * Regression guards: a stale/empty `"friendli": {}` slice once left the
 * descriptor's `defaultModel` unresolvable at boot (#9410), and a hand-written
 * `thinking` block on the seed would fight the identity-derived ladder.
 */
function spec(): ModelSpec<"openai-completions"> {
	return {
		id: "zai-org/GLM-5.3",
		name: "GLM-5.3",
		api: "openai-completions",
		provider: "friendli",
		baseUrl: "https://api.friendli.ai/serverless/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
		contextWindow: 1_048_576,
		maxTokens: 1_048_576,
	};
}

describe("Friendli static seed", () => {
	it("resolves the bundled provider catalog with the seeded flagship", async () => {
		const result = await resolveProviderModels({ providerId: "friendli" }, "offline");
		expect(result.source).toBe("bundled");
		expect(result.models.map(model => model.id)).toEqual(["zai-org/GLM-5.3"]);
	});

	it("derives the wire reasoning surface from identity, not a seed thinking block", () => {
		const model = buildModel(spec()) as Model<"openai-completions">;
		// GLM-5.3+ exposes a uniform low/high/max ladder with thinking always on;
		// the effort tiers must reach the wire as distinct `reasoning_effort` values.
		expect(model.thinking?.efforts).toEqual([Effort.Low, Effort.High, Effort.Max]);
		expect(model.thinking?.defaultLevel).toBe(Effort.Max);
		expect(model.compat.supportsReasoningEffort).toBe(true);
		expect(model.compat.thinkingFormat).toBe("openai");
	});
});
