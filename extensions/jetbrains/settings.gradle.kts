// GrillMyCode Companion for JetBrains IDEs. A Gradle build of its own, apart
// from the repository's pnpm projects: nothing here is part of the action.

import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform

rootProject.name = "grillmycode-jetbrains"

pluginManagement {
    plugins {
        id("org.jetbrains.kotlin.jvm") version "2.4.21"
        id("org.jetbrains.changelog") version "2.5.0"
        id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
    }
}

plugins {
    // Downloads the JDK the toolchain asks for when the machine has none.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
    id("org.jetbrains.intellij.platform.settings") version "2.19.0"
}

@Suppress("UnstableApiUsage")
dependencyResolutionManagement {
    repositories {
        mavenCentral()
        intellijPlatform {
            defaultRepositories()
        }
    }
}
