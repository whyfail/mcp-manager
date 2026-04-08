use crate::database::Database;

/// 应用全局状态
pub struct AppState {
    pub db: Database,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self { db }
    }
}
