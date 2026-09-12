import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { loadSharedAgentMemory, buildSharedLearningBlock } from "@/lib/ai-memory";

describe("loadSharedAgentMemory", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls get_agent_memory_context with sensible defaults", async () => {
    rpcMock.mockResolvedValue({
      data: { directives: [], research: [], learning: [] },
      error: null,
    });
    await loadSharedAgentMemory();
    expect(rpcMock).toHaveBeenCalledWith("get_agent_memory_context", {
      p_directive_limit: 20,
      p_research_limit: 10,
      p_learning_limit: 30,
      p_scope: null,
    });
  });

  it("passes through custom options", async () => {
    rpcMock.mockResolvedValue({
      data: { directives: [], research: [], learning: [] },
      error: null,
    });
    await loadSharedAgentMemory({
      directiveLimit: 5,
      researchLimit: 2,
      learningLimit: 8,
      scope: "chat",
    });
    expect(rpcMock).toHaveBeenCalledWith("get_agent_memory_context", {
      p_directive_limit: 5,
      p_research_limit: 2,
      p_learning_limit: 8,
      p_scope: "chat",
    });
  });

  it("returns the parsed context on success", async () => {
    const payload = {
      directives: [{ topic: "t", directive: "d", importance: 5, tags: [], created_at: "now" }],
      research: [],
      learning: [
        {
          scope: "global",
          category: "market",
          key: "k",
          value: "v",
          importance: 9,
          tags: [],
          is_locked: true,
          updated_at: "now",
        },
      ],
    };
    rpcMock.mockResolvedValue({ data: payload, error: null });
    const result = await loadSharedAgentMemory();
    expect(result).toEqual(payload);
  });

  it("returns an empty context on RPC error instead of throwing", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await loadSharedAgentMemory();
    expect(result).toEqual({ directives: [], research: [], learning: [] });
  });

  it("fills in missing fields from a partial response with empty arrays", async () => {
    rpcMock.mockResolvedValue({ data: { learning: [] }, error: null });
    const result = await loadSharedAgentMemory();
    expect(result.directives).toEqual([]);
    expect(result.research).toEqual([]);
  });
});

describe("buildSharedLearningBlock", () => {
  it("returns an empty string when there is no learning data", () => {
    expect(buildSharedLearningBlock({ directives: [], research: [], learning: [] })).toBe("");
  });

  it("only includes locked (permanent, vetted) learnings, not provisional ones", () => {
    const ctx = {
      directives: [],
      research: [],
      learning: [
        {
          scope: "global",
          category: "market",
          key: "a",
          value: "Locked fact",
          importance: 9,
          tags: [],
          is_locked: true,
          updated_at: "now",
        },
        {
          scope: "global",
          category: "guess",
          key: "b",
          value: "Unverified guess",
          importance: 3,
          tags: [],
          is_locked: false,
          updated_at: "now",
        },
      ],
    };
    const block = buildSharedLearningBlock(ctx);
    expect(block).toContain("Locked fact");
    expect(block).not.toContain("Unverified guess");
  });

  it("returns an empty string when all learnings are unlocked/provisional", () => {
    const ctx = {
      directives: [],
      research: [],
      learning: [
        {
          scope: "global",
          category: "guess",
          key: "b",
          value: "Unverified guess",
          importance: 3,
          tags: [],
          is_locked: false,
          updated_at: "now",
        },
      ],
    };
    expect(buildSharedLearningBlock(ctx)).toBe("");
  });

  it("caps output at 20 entries", () => {
    const learning = Array.from({ length: 30 }, (_, i) => ({
      scope: "global",
      category: "c",
      key: `k${i}`,
      value: `fact-${i}`,
      importance: 5,
      tags: [],
      is_locked: true,
      updated_at: "now",
    }));
    const block = buildSharedLearningBlock({ directives: [], research: [], learning });
    const lineCount = block.split("\n").filter((l) => l.startsWith("- ")).length;
    expect(lineCount).toBe(20);
  });
});
