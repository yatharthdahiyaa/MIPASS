"""Tests for the health check endpoint."""


def test_health_check(client):
    """Test that the health endpoint returns 200 with service info."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["service"] == "mipaas-api"
    assert "version" in data


def test_health_check_content_type(client):
    """Test that the health endpoint returns JSON."""
    response = client.get("/api/v1/health")
    assert response.content_type == "application/json"
