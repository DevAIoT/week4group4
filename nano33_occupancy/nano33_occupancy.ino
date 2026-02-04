// Expected input per line (CSV):
// flow_id,date,time,count
// Example: 7,07/24/05,00:00:00,4
// Output per unique timestamp:
// date,time,occupancy

#include <Arduino_APDS9960.h>

const unsigned long SERIAL_BAUD = 230400;

String lineBuf;

String currentDate = "";
String currentTime = "";
long pendingIn = 0;
long pendingOut = 0;
long occupancy = 0;
bool haveCurrent = false;
bool headerSent = false;
bool apdsOk = false;

String getField(const String &s, int index) {
  int field = 0;
  int start = 0;
  for (int i = 0; i <= s.length(); i++) {
    if (i == s.length() || s.charAt(i) == ',') {
      if (field == index) {
        return s.substring(start, i);
      }
      field++;
      start = i + 1;
    }
  }
  return "";
}

void emitCurrent() {
  if (!haveCurrent) return;
  long net = pendingIn - pendingOut;
  occupancy += net;
  Serial.print(currentDate);
  Serial.print(",");
  Serial.print(currentTime);
  Serial.print(",");
  Serial.println(occupancy);
  pendingIn = 0;
  pendingOut = 0;
}

void handleLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (line == "RESET") {
    emitCurrent();
    occupancy = 0;
    pendingIn = 0;
    pendingOut = 0;
    haveCurrent = false;
    currentDate = "";
    currentTime = "";
    Serial.println("ACK");
    return;
  }

  if (line == "FLUSH") {
    emitCurrent();
    Serial.println("ACK");
    return;
  }

  if (!headerSent) {
    Serial.println("date,time,occupancy");
    headerSent = true;
  }

  // Ignore header lines if they appear
  if (line.startsWith("flow_id") || line.startsWith("#")) {
    Serial.println("ACK");
    return;
  }

  String flowStr = getField(line, 0);
  String dateStr = getField(line, 1);
  String timeStr = getField(line, 2);
  String countStr = getField(line, 3);

  if (flowStr.length() == 0 || dateStr.length() == 0 || timeStr.length() == 0 || countStr.length() == 0) {
    Serial.println("ACK");
    return;
  }

  int flowId = flowStr.toInt();
  long count = countStr.toInt();

  if (!haveCurrent) {
    currentDate = dateStr;
    currentTime = timeStr;
    haveCurrent = true;
  }

  if (dateStr != currentDate || timeStr != currentTime) {
    emitCurrent();
    currentDate = dateStr;
    currentTime = timeStr;
  }

  // Match preprocess.py: outflow=flow_id 7, inflow=flow_id 9
  if (flowId == 7) {
    pendingOut += count;
  } else if (flowId == 9) {
    pendingIn += count;
  }
  Serial.println("ACK");
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  while (!Serial) {}

  apdsOk = APDS.begin();
  if (apdsOk) {
    APDS.setGestureSensitivity(100);
  } else {
    Serial.println("ERR=APDS9960_INIT");
  }
}

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (lineBuf.length() > 0) {
        handleLine(lineBuf);
        lineBuf = "";
      }
    } else {
      lineBuf += c;
      if (lineBuf.length() > 160) {
        lineBuf = "";
      }
    }
  }

  if (apdsOk && APDS.gestureAvailable()) {
    int gesture = APDS.readGesture();
    if (gesture == 0 || gesture == 1) {
      Serial.print("GESTURE=");
      Serial.println(gesture);
    }
  }
}
