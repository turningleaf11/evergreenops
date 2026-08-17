import { emailInputValidators } from "./schemas.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("email_list schema accepts only bounded pagination inputs", () => {
  assert(emailInputValidators.email_list.safeParse({}).success);
  assert(
    emailInputValidators.email_list.safeParse({
      max_results: 50,
      page_token: "valid_page-token",
      after_epoch_seconds: 1_786_900_000,
    }).success,
  );
  assert(
    !emailInputValidators.email_list.safeParse({ max_results: 0 }).success,
  );
  assert(
    !emailInputValidators.email_list.safeParse({ max_results: 51 }).success,
  );
  assert(
    !emailInputValidators.email_list.safeParse({ max_results: 1.5 }).success,
  );
  assert(
    !emailInputValidators.email_list.safeParse({ page_token: "bad token" })
      .success,
  );
  assert(
    !emailInputValidators.email_list.safeParse({ after_epoch_seconds: -1 })
      .success,
  );
});

Deno.test("email_search schema requires a bounded nonblank query", () => {
  const valid = emailInputValidators.email_search.safeParse({
    query: "  newer_than:7d  ",
    max_results: 10,
  });
  assert(valid.success);
  assert(valid.data.query === "newer_than:7d");
  assert(
    !emailInputValidators.email_search.safeParse({ query: "   " }).success,
  );
  assert(
    !emailInputValidators.email_search.safeParse({ query: "x".repeat(501) })
      .success,
  );
});

Deno.test("email_read schema accepts only Gmail-safe thread IDs", () => {
  assert(
    emailInputValidators.email_read.safeParse({ thread_id: "18f_ab-CD" })
      .success,
  );
  assert(!emailInputValidators.email_read.safeParse({ thread_id: "" }).success);
  assert(
    !emailInputValidators.email_read.safeParse({ thread_id: "../../secret" })
      .success,
  );
});

Deno.test("email_get_attachment schema requires both Gmail-safe IDs", () => {
  assert(
    emailInputValidators.email_get_attachment.safeParse({
      message_id: "message_123",
      attachment_id: "attachment-456",
    }).success,
  );
  assert(
    !emailInputValidators.email_get_attachment.safeParse({
      message_id: "message_123",
    }).success,
  );
  assert(
    !emailInputValidators.email_get_attachment.safeParse({
      message_id: "message 123",
      attachment_id: "attachment-456",
    }).success,
  );
});
