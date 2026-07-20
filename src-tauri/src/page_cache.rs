//! 현재 아카이브의 페이지 바이트를 담는 인메모리 캐시.
//!
//! 아카이브를 열면 백그라운드 스레드가 전체 페이지를 순차 추출해 여기에 채우고,
//! `pvpage://` 프로토콜 핸들러는 캐시를 우선 조회한다(미스 시 온디맨드 추출로 폴백).
//! 파일 전환 시 세대(generation)를 올려 무효화하므로, 진행 중이던 옛 스레드가
//! 새 아카이브의 캐시를 오염시키지 않는다.

use std::collections::HashMap;
use std::sync::Arc;

#[derive(Default)]
pub struct PageCache {
    /// 현재 세션 세대. `reset`마다 증가한다.
    generation: u64,
    /// 페이지 index → 인코딩 이미지 바이트.
    pages: HashMap<usize, Arc<Vec<u8>>>,
}

impl PageCache {
    /// 새 세션 시작: 세대를 올리고 캐시를 비운다. 프리페치 스레드에 넘길 새 세대 번호를 반환.
    pub fn reset(&mut self) -> u64 {
        self.generation += 1;
        self.pages.clear();
        self.generation
    }

    /// `gen`이 여전히 최신 세대일 때만 삽입한다. 낡았으면 삽입하지 않고 `false`를 반환해
    /// (프리페치 스레드에) 중단을 신호한다.
    pub fn insert_if_current(&mut self, gen: u64, idx: usize, bytes: Vec<u8>) -> bool {
        if self.generation != gen {
            return false;
        }
        self.pages.insert(idx, Arc::new(bytes));
        true
    }

    /// 캐시된 페이지 바이트(있으면). 없으면 `None`(핸들러가 온디맨드로 폴백).
    pub fn get(&self, idx: usize) -> Option<Arc<Vec<u8>>> {
        self.pages.get(&idx).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_returns_inserted_and_none_on_miss() {
        let mut c = PageCache::default();
        let gen = c.reset();
        assert!(c.get(0).is_none());
        assert!(c.insert_if_current(gen, 0, vec![1, 2, 3]));
        assert_eq!(c.get(0).as_deref(), Some(&vec![1, 2, 3]));
        assert!(c.get(1).is_none());
    }

    #[test]
    fn reset_clears_and_stale_generation_insert_is_rejected() {
        let mut c = PageCache::default();
        let old = c.reset();
        assert!(c.insert_if_current(old, 0, vec![1]));
        // 새 세션: 세대가 올라가고 캐시가 비워진다.
        let _new = c.reset();
        assert!(c.get(0).is_none());
        // 옛 세대로 시도한 삽입은 거부되고, 중단 신호(false)를 준다.
        assert!(!c.insert_if_current(old, 0, vec![9]));
        assert!(c.get(0).is_none());
    }
}
