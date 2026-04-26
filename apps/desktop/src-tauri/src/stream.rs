use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "system")]
    System {
        subtype: String,
        #[serde(flatten)]
        payload: serde_json::Value,
    },
    #[serde(rename = "assistant")]
    Assistant { message: serde_json::Value },
    #[serde(rename = "user")]
    User { message: serde_json::Value },
    #[serde(rename = "result")]
    Result {
        #[serde(flatten)]
        payload: serde_json::Value,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug)]
pub enum ParseOutcome {
    Event(StreamEvent),
    Skip { reason: String, raw: String },
}

pub fn parse_line(line: &str) -> ParseOutcome {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return ParseOutcome::Skip {
            reason: "empty".into(),
            raw: line.into(),
        };
    }
    match serde_json::from_str::<StreamEvent>(trimmed) {
        Ok(ev) => ParseOutcome::Event(ev),
        Err(e) => ParseOutcome::Skip {
            reason: e.to_string(),
            raw: line.into(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_system_init() {
        let line = r#"{"type":"system","subtype":"init","session_id":"abc"}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::System { subtype, .. }) => assert_eq!(subtype, "init"),
            _ => panic!("expected system event"),
        }
    }

    #[test]
    fn parses_assistant_message() {
        let line =
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::Assistant { .. }) => {}
            _ => panic!("expected assistant event"),
        }
    }

    #[test]
    fn parses_user_message() {
        let line = r#"{"type":"user","message":"hello"}"#;
        assert!(matches!(
            parse_line(line),
            ParseOutcome::Event(StreamEvent::User { .. })
        ));
    }

    #[test]
    fn parses_result() {
        let line = r#"{"type":"result","total_cost_usd":0.1,"duration_ms":4200}"#;
        assert!(matches!(
            parse_line(line),
            ParseOutcome::Event(StreamEvent::Result { .. })
        ));
    }

    #[test]
    fn skips_non_json() {
        match parse_line("not json") {
            ParseOutcome::Skip { reason, .. } => assert!(!reason.is_empty()),
            _ => panic!("expected skip"),
        }
    }

    #[test]
    fn skips_empty_line() {
        assert!(matches!(parse_line(""), ParseOutcome::Skip { .. }));
    }

    #[test]
    fn unknown_type_falls_through() {
        let line = r#"{"type":"weird"}"#;
        match parse_line(line) {
            ParseOutcome::Event(StreamEvent::Unknown) => {}
            _ => panic!("expected unknown variant"),
        }
    }
}
