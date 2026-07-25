resource "azurerm_resource_group" "sovr" {
  name     = "sovr-rg"
  location = "East US"
}

resource "azurerm_kubernetes_cluster" "sovr" {
  name                = "sovr-aks"
  location            = azurerm_resource_group.sovr.location
  resource_group_name = azurerm_resource_group.sovr.name
  dns_prefix          = "sovr"
  kubernetes_version  = "1.28"

  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_D4s_v3"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
  }
}

resource "azurerm_postgresql_flexible_server" "sovr" {
  name                   = "sovr-postgres"
  resource_group_name    = azurerm_resource_group.sovr.name
  location               = azurerm_resource_group.sovr.location
  version                = "18"
  administrator_login    = "sovr"
  administrator_password = var.db_password
  zone                   = "1"
  storage_mb             = 51200
  sku_name               = "B_Standard_B4ms"
  backup_retention_days  = 7
}

resource "azurerm_redis_cache" "sovr" {
  name                = "sovr-redis"
  location            = azurerm_resource_group.sovr.location
  resource_group_name = azurerm_resource_group.sovr.name
  capacity            = 2
  family              = "P"
  sku_name            = "Premium"
  enable_non_ssl_port = false
}
