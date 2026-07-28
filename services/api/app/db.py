def psycopg_connection_kwargs() -> dict[str, object]:
    return {"prepare_threshold": None}


def psycopg_pool_kwargs() -> dict[str, object]:
    return {"kwargs": psycopg_connection_kwargs()}
