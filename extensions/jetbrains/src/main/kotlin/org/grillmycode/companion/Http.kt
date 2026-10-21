package org.grillmycode.companion

import com.intellij.util.io.HttpRequests
import org.grillmycode.companion.shared.HttpResponse
import java.net.HttpURLConnection

/**
 * The [org.grillmycode.companion.shared.HttpGet] the plugin passes to shared/:
 * a GET through the IDE's proxy settings, which answers with the status rather
 * than throwing on one that is not 200.
 */
fun httpGet(
    url: String,
    headers: Map<String, String>,
): HttpResponse =
    HttpRequests
        .request(url)
        .productNameAsUserAgent()
        .throwStatusCodeException(false)
        .tuner { connection -> headers.forEach(connection::setRequestProperty) }
        .connect { request ->
            val status = (request.connection as HttpURLConnection).responseCode
            HttpResponse(status, if (status == 200) request.readString() else "")
        }
