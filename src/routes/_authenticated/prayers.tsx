import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  EmptyState,
  ScreenTitle,
  SectionHeader,
  Skeleton,
  Textarea,
} from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/prayers")({
  head: () => ({ meta: [{ title: "My Prayers · Faith Companion" }] }),
  component: Prayers,
});

type Prayer = {
  id: string;
  body: string;
  answered: boolean;
  answered_note: string | null;
  created_at: string;
};

function Prayers() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerNote, setAnswerNote] = useState("");
  const key = ["personal-prayers", user.id];

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Prayer[]> => {
      const { data, error } = await (supabase as any)
        .from("personal_prayers")
        .select("id, body, answered, answered_note, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Prayer[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      const { error } = await (supabase as any)
        .from("personal_prayers")
        .insert({ user_id: user.id, body: text });
      if (error) throw error;
    },
    onSuccess: async () => {
      setBody("");
      await qc.invalidateQueries({ queryKey: key });
    },
  });

  const answer = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any)
        .from("personal_prayers")
        .update({
          answered: true,
          answered_note: note.trim() || null,
          answered_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setAnsweringId(null);
      setAnswerNote("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("personal_prayers").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const open = (q.data ?? []).filter((p) => !p.answered);
  const answered = (q.data ?? []).filter((p) => p.answered);

  return (
    <AppShell title="My Prayers">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="My Prayers"
          subtitle="A private list of what you're bringing to God. Mark them answered to keep a record of his faithfulness."
        />

        <Card className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="What are you praying for?"
          />
          <Button
            leftIcon="add"
            block
            loading={add.isPending}
            disabled={body.trim().length === 0}
            onClick={() => add.mutate()}
          >
            Add to my list
          </Button>
        </Card>

        {q.isLoading ? (
          <Skeleton className="h-24" />
        ) : open.length === 0 && answered.length === 0 ? (
          <EmptyState
            icon="front_hand"
            title="Your prayer list is empty"
            description="Add the first thing on your heart above."
          />
        ) : (
          <>
            {open.length > 0 && (
              <section className="space-y-2">
                <SectionHeader>Praying for</SectionHeader>
                <ul className="space-y-2">
                  {open.map((p) => (
                    <li key={p.id}>
                      <Card className="space-y-3">
                        <p className="whitespace-pre-wrap text-on-surface">
                          {p.body}
                        </p>
                        {answeringId === p.id ? (
                          <div className="space-y-2 border-t border-divider-soft pt-3">
                            <Textarea
                              value={answerNote}
                              onChange={(e) => setAnswerNote(e.target.value)}
                              rows={2}
                              maxLength={400}
                              placeholder="How was it answered? (optional)"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                loading={answer.isPending}
                                onClick={() =>
                                  answer.mutate({ id: p.id, note: answerNote })
                                }
                              >
                                Mark answered
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAnsweringId(null);
                                  setAnswerNote("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 border-t border-divider-soft pt-3 text-sm">
                            <button
                              onClick={() => {
                                setAnsweringId(p.id);
                                setAnswerNote("");
                              }}
                              className="flex items-center gap-1.5 font-semibold text-primary transition-gentle hover:text-wood-warm"
                            >
                              <Icon name="check_circle" className="text-base" />
                              Mark answered
                            </button>
                            <button
                              onClick={() => remove.mutate(p.id)}
                              className="ml-auto text-on-surface-variant hover:text-destructive"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {answered.length > 0 && (
              <section className="space-y-2">
                <SectionHeader>Answered</SectionHeader>
                <ul className="space-y-2">
                  {answered.map((p) => (
                    <li key={p.id}>
                      <Card tone="accent">
                        <p className="whitespace-pre-wrap text-on-surface line-through decoration-wood-warm/40">
                          {p.body}
                        </p>
                        {p.answered_note && (
                          <p className="mt-2 font-serif italic text-on-surface-variant">
                            “{p.answered_note}”
                          </p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
