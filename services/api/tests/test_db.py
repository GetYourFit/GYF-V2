from app.db import psycopg_connection_kwargs, psycopg_pool_kwargs


def test_psycopg_connection_kwargs_disable_prepared_statements():
    assert psycopg_connection_kwargs() == {"prepare_threshold": None}


def test_psycopg_pool_kwargs_disable_prepared_statements():
    assert psycopg_pool_kwargs() == {"kwargs": {"prepare_threshold": None}}
