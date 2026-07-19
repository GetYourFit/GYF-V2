"""Social tests — posts, ranked feed, reactions, and the follow graph."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.main import app, get_account_repo, get_item_directory, get_social_repo
from app.profile.account import InMemoryAccountRepository
from app.social import InMemorySocialRepository, PostRecord

DEV_USER = "00000000-0000-0000-0000-000000000001"

_ITEM = ItemDetail(
    item_id="item-1",
    title="Red Dress",
    category="dress",
    slot="full_body",
    price=80.0,
    currency="USD",
    color="red",
    buy_url=None,
    image_url="/media/item-1.jpg",
)


def _client(repo=None) -> TestClient:
    repo = repo if repo is not None else InMemorySocialRepository()
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_social_repo] = lambda: repo
    app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory([_ITEM])
    return TestClient(app)


def test_create_post_then_feed_renders_look():
    repo = InMemorySocialRepository()
    try:
        client = _client(repo)
        r = client.post("/social/posts", json={"item_ids": ["item-1"], "caption": "OOTD"})
        assert r.status_code == 201
        assert r.json()["items"][0]["title"] == "Red Dress"
        feed = client.get("/social/posts").json()["posts"]
        assert len(feed) == 1
        assert feed[0]["caption"] == "OOTD"
    finally:
        app.dependency_overrides.clear()


def test_create_post_requires_items():
    try:
        client = _client()
        assert client.post("/social/posts", json={"item_ids": []}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_react_is_idempotent_and_bumps_count():
    repo = InMemorySocialRepository()
    try:
        client = _client(repo)
        pid = client.post("/social/posts", json={"item_ids": ["item-1"]}).json()["id"]
        first = client.post(f"/social/posts/{pid}/react", json={"reaction": "like"}).json()
        assert first["reacted"] is True
        second = client.post(f"/social/posts/{pid}/react", json={"reaction": "like"}).json()
        assert second["reacted"] is False  # one reaction per (post, user)
        assert repo.get(pid).reaction_count == 1
    finally:
        app.dependency_overrides.clear()


def test_unreact_removes_reaction_and_feed_marks_viewer_state():
    repo = InMemorySocialRepository()
    try:
        client = _client(repo)
        pid = client.post("/social/posts", json={"item_ids": ["item-1"]}).json()["id"]
        client.post(f"/social/posts/{pid}/react", json={"reaction": "like"})
        assert client.get("/social/posts").json()["posts"][0]["reacted"] is True

        assert client.delete(f"/social/posts/{pid}/react").status_code == 204
        assert repo.get(pid).reaction_count == 0
        assert client.get("/social/posts").json()["posts"][0]["reacted"] is False
        # idempotent: a second unreact is a 204 no-op and never goes negative
        assert client.delete(f"/social/posts/{pid}/react").status_code == 204
        assert repo.get(pid).reaction_count == 0
    finally:
        app.dependency_overrides.clear()


def test_react_unknown_post_404s():
    try:
        client = _client()
        r = client.post("/social/posts/missing/react", json={"reaction": "like"})
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_feed_ranks_by_reactions():
    repo = InMemorySocialRepository()
    try:
        client = _client(repo)
        a = client.post("/social/posts", json={"item_ids": ["item-1"], "caption": "A"}).json()["id"]
        client.post("/social/posts", json={"item_ids": ["item-1"], "caption": "B"})
        client.post(f"/social/posts/{a}/react", json={"reaction": "like"})
        feed = client.get("/social/posts").json()["posts"]
        assert feed[0]["caption"] == "A"  # most-reacted first
    finally:
        app.dependency_overrides.clear()


# --- Follow graph -----------------------------------------------------------

OTHER_USER = "00000000-0000-0000-0000-000000000002"


def _other_post(post_id: str = "post-other") -> PostRecord:
    return PostRecord(id=post_id, user_id=OTHER_USER, item_ids=["item-1"], caption="theirs")


def test_follow_is_idempotent_and_listed():
    try:
        client = _client()
        first = client.put(f"/social/follows/{OTHER_USER}").json()
        assert first == {"user_id": OTHER_USER, "following": True, "newly": True}
        second = client.put(f"/social/follows/{OTHER_USER}").json()
        assert second["newly"] is False  # idempotent PUT
        assert client.get("/social/follows").json()["following"] == [OTHER_USER]
    finally:
        app.dependency_overrides.clear()


def test_unfollow_is_idempotent():
    try:
        client = _client()
        client.put(f"/social/follows/{OTHER_USER}")
        assert client.delete(f"/social/follows/{OTHER_USER}").status_code == 204
        assert client.get("/social/follows").json()["following"] == []
        # Unfollowing again (or someone never followed) is still a clean 204.
        assert client.delete(f"/social/follows/{OTHER_USER}").status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_self_follow_rejected():
    try:
        client = _client()
        assert client.put(f"/social/follows/{DEV_USER}").status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_follow_unknown_user_404s():
    repo = InMemorySocialRepository(known_users={DEV_USER, OTHER_USER})
    try:
        client = _client(repo)
        assert client.put("/social/follows/no-such-user").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_following_scope_filters_feed():
    repo = InMemorySocialRepository()
    repo.create(_other_post())
    try:
        client = _client(repo)
        client.post("/social/posts", json={"item_ids": ["item-1"], "caption": "mine"})

        # Following nobody → the following feed is empty, the global feed has both.
        assert client.get("/social/posts", params={"scope": "following"}).json()["posts"] == []
        assert len(client.get("/social/posts").json()["posts"]) == 2

        client.put(f"/social/follows/{OTHER_USER}")
        following = client.get("/social/posts", params={"scope": "following"}).json()["posts"]
        assert [p["caption"] for p in following] == ["theirs"]
    finally:
        app.dependency_overrides.clear()


OTHER_USER = "00000000-0000-0000-0000-000000000002"


def _post_by(repo: InMemorySocialRepository, user_id: str, post_id: str = "p-1") -> None:
    repo.create(
        PostRecord(
            id=post_id,
            user_id=user_id,
            item_ids=["item-1"],
            recommendation_id=None,
            occasion=None,
            caption=None,
            reaction_count=0,
        )
    )


def test_report_post_records_and_unknown_404s():
    repo = InMemorySocialRepository()
    _post_by(repo, OTHER_USER)
    try:
        client = _client(repo)
        r = client.post("/social/posts/p-1/report", json={"reason": "spam"})
        assert r.status_code == 204
        assert client.post("/social/posts/ghost/report", json={"reason": "spam"}).status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_block_hides_author_from_feed_and_is_idempotent():
    repo = InMemorySocialRepository(known_users={DEV_USER, OTHER_USER})
    _post_by(repo, OTHER_USER)
    try:
        client = _client(repo)
        assert len(client.get("/social/posts").json()["posts"]) == 1
        assert client.put(f"/social/blocks/{OTHER_USER}").status_code == 204
        assert client.put(f"/social/blocks/{OTHER_USER}").status_code == 204  # idempotent
        assert client.get("/social/posts").json()["posts"] == []
        assert client.get("/social/blocks").json()["blocked"] == [OTHER_USER]
        assert client.delete(f"/social/blocks/{OTHER_USER}").status_code == 204
        assert len(client.get("/social/posts").json()["posts"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_block_rejects_self_and_unknown_user():
    repo = InMemorySocialRepository(known_users={DEV_USER})
    try:
        client = _client(repo)
        assert client.put(f"/social/blocks/{DEV_USER}").status_code == 422
        assert client.put(f"/social/blocks/{OTHER_USER}").status_code == 404
    finally:
        app.dependency_overrides.clear()
