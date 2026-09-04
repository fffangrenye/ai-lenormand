import { AnswerProposition } from "./answer-types";
import { QuestionContext } from "./ontology";

export function buildAnswerProposition(question: QuestionContext): AnswerProposition {
  const timeframeBound = question.timeframe.scope === "explicit" ? question.timeframe : undefined;
  if (question.actionFrame?.action) {
    return {
      subject: question.actionFrame.actorPersonId,
      action: question.actionFrame.action,
      object: question.actionFrame.recipientPersonId,
      desiredState: question.actionFrame.action === "contact" ? "receive_message_or_contact" : undefined,
      timeframeBound,
      propositionType: "action",
      source: "action_frame"
    };
  }

  if (question.intent === "feelings_attitude") {
    return {
      subject: question.perspective?.subjectPersonId ?? question.people.find((person) => person.id !== "self")?.id,
      object: question.perspective?.objectPersonId ?? "self",
      desiredState: "affection_or_attraction",
      timeframeBound,
      propositionType: "feeling",
      source: "intent"
    };
  }

  if (question.intent === "timing") return base(question, "timing", "timing_tendency", timeframeBound);
  if (question.intent === "location") return base(question, "location", "location_description", timeframeBound);
  if (question.intent === "description" || question.intent === "reason" || question.intent === "advice" || question.intent === "comparison" || question.intent === "decision") {
    return base(question, question.intent === "description" ? "description" : "other", `${question.intent}_${question.object.type}`, timeframeBound);
  }

  if (question.primaryTopic === "reconciliation" || /复合|和好|重新在一起/.test(question.object.label)) return base(question, "outcome", "relationship_reconciliation", timeframeBound);
  if (question.primaryTopic === "commitment" || /确定关系|承诺|稳定/.test(question.object.label)) return base(question, "outcome", "relationship_commitment", timeframeBound);
  if (question.object.type === "message" || question.primaryTopic === "communication") {
    return {
      subject: question.actionFrame?.actorPersonId,
      action: "contact",
      object: question.actionFrame?.recipientPersonId ?? question.object.label,
      desiredState: "receive_message_or_contact",
      timeframeBound,
      propositionType: question.intent === "development" ? "development" : "action",
      source: question.object.type === "message" ? "question_object" : "intent"
    };
  }
  if (/解决|成功|完成|通过|拿到/.test(question.object.label)) return base(question, "outcome", "resolved_or_successful_outcome", timeframeBound);
  if (/进展|推进|变化|改变|发展/.test(question.object.label)) return base(question, "outcome", "progress_or_change", timeframeBound);
  if (question.intent === "development") return base(question, "development", "semantic_trajectory", timeframeBound);
  if (question.intent === "obstacle") return base(question, "obstacle", "main_obstacle", timeframeBound);
  if (question.intent === "outcome") return base(question, "outcome", `${question.object.type}_outcome`, timeframeBound);
  return base(question, "state", `${question.object.type}_state`, timeframeBound);
}

function base(question: QuestionContext, propositionType: AnswerProposition["propositionType"], desiredState: string, timeframeBound: AnswerProposition["timeframeBound"]): AnswerProposition {
  return {
    subject: question.people.find((person) => person.isPrimary)?.id,
    object: question.object.label || question.object.type,
    desiredState,
    timeframeBound,
    propositionType,
    source: question.object.type !== "other" ? "question_object" : "intent"
  };
}
