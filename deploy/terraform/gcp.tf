resource "google_project" "sovr" {
  name       = "sovr-protocol"
  project_id = "sovr-protocol"
}

resource "google_container_cluster" "sovr" {
  name     = "sovr-gke"
  location = "us-central1"

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.sovr.name
  subnetwork = google_compute_subnetwork.sovr.name
}

resource "google_container_node_pool" "sovr" {
  name       = "sovr-node-pool"
  cluster    = google_container_cluster.sovr.name
  location   = "us-central1"
  node_count = 3

  node_config {
    machine_type = "e2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-standard"
  }
}

resource "google_sql_database_instance" "sovr_postgres" {
  name             = "sovr-postgres"
  database_version = "POSTGRES_18"
  region           = "us-central1"

  settings {
    tier              = "db-custom-4-16384"
    availability_type = "REGIONAL"
    disk_size         = 100
    disk_type         = "PD_SSD"
  }

  deletion_protection = false
}

resource "google_redis_instance" "sovr_redis" {
  name           = "sovr-redis"
  memory_size_gb = 5
  region         = "us-central1"
  redis_version  = "REDIS_7"
  display_name   = "SOVR Redis"
}
