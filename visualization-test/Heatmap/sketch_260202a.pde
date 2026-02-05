
import processing.event.MouseEvent;

PImage mapImg;

// ---------- WORLD / RENDER SETTINGS ----------
float GROUND_Y = 0;
float EXTRUDE_BASE = 2;

// Camera (simple orbit)
float camDist = 1200;
float camYaw = radians(45);
float camPitch = radians(55);
PVector camTarget = new PVector(0, 0, 0);

// ---------- LAYERS ----------
ArrayList<PolyShape> buildings = new ArrayList<PolyShape>();
ArrayList<PolyShape> roads     = new ArrayList<PolyShape>();
ArrayList<PolyShape> walks     = new ArrayList<PolyShape>();

void setup() {
  size(1280, 800, P3D);
  smooth(8);

  // Optional: only needed if you want the grass plane sized to the map image.
  // If you DON'T need the map image at all, remove these 2 lines and set groundW/groundH manually.
  mapImg = loadImage("campus.png");

  loadYourScene(); // <-- put your exported polygons here
}

void draw() {
  background(235);

  ambientLight(120, 120, 120);
  directionalLight(220, 220, 220, -0.6, -1.0, -0.4);

  applyOrbitCamera();

  // Grass
  drawGrassPlane();

  // Roads / Walkways
  drawLayerPolys(roads, color(110), EXTRUDE_BASE);
  drawLayerPolys(walks, color(245), EXTRUDE_BASE);

  // Buildings
  for (PolyShape b : buildings) {
    drawExtrudedPolygon(b.pts, b.col, b.height);
  }
}

// ---------- CAMERA ----------
void applyOrbitCamera() {
  if (mousePressed && mouseButton == LEFT) {
    camYaw   += (pmouseX - mouseX) * 0.01;
    camPitch += (mouseY - pmouseY) * 0.01;
    camPitch = constrain(camPitch, radians(10), radians(85));
  }

  float cx = camTarget.x + camDist * cos(camPitch) * cos(camYaw);
  float cy = camTarget.y - camDist * sin(camPitch);
  float cz = camTarget.z + camDist * cos(camPitch) * sin(camYaw);

  camera(cx, cy, cz, camTarget.x, camTarget.y, camTarget.z, 0, 1, 0);
}

void mouseWheel(MouseEvent e) {
  float amt = e.getCount();
  camDist *= (1.0 + amt * 0.05);
  camDist = constrain(camDist, 300, 6000);
}

// ---------- DRAW HELPERS ----------
void drawGrassPlane() {
  // If you loaded campus.png, size the grass to match it.
  // Otherwise, set your own width/height.
  float groundW = (mapImg != null) ? mapImg.width  : 2000;
  float groundH = (mapImg != null) ? mapImg.height : 1200;

  // These shapes are already in "world coords" from your export,
  // so we just draw a big plane that covers the area.
  pushMatrix();
  translate(0, GROUND_Y, 0);
  rotateX(HALF_PI);
  noStroke();
  fill(120, 180, 120);
  rectMode(CENTER);
  rect(0, 0, groundW, groundH);
  popMatrix();
}

void drawLayerPolys(ArrayList<PolyShape> layer, int col, float thickness) {
  for (PolyShape p : layer) {
    drawExtrudedPolygon(p.pts, col, thickness);
  }
}

void drawExtrudedPolygon(ArrayList<PVector> pts, int col, float height) {
  if (pts == null || pts.size() < 3) return;

  noStroke();
  fill(col);

  // Top face
  beginShape();
  for (PVector v : pts) vertex(v.x, GROUND_Y - height, v.z);
  endShape(CLOSE);

  // Side walls
  for (int i = 0; i < pts.size(); i++) {
    PVector a = pts.get(i);
    PVector b = pts.get((i + 1) % pts.size());

    beginShape(QUADS);
    vertex(a.x, GROUND_Y,           a.z);
    vertex(b.x, GROUND_Y,           b.z);
    vertex(b.x, GROUND_Y - height,  b.z);
    vertex(a.x, GROUND_Y - height,  a.z);
    endShape();
  }
}

// ---------- DATA MODEL ----------
class PolyShape {
  ArrayList<PVector> pts;
  int col;
  float height;
  PolyShape(ArrayList<PVector> pts, int col, float height) {
    this.pts = pts;
    this.col = col;
    this.height = height;
  }
}

ArrayList<PVector> poly(PVector... vs) {
  ArrayList<PVector> out = new ArrayList<PVector>();
  for (PVector v : vs) out.add(v);
  return out;
}

// ---------- YOUR EXPORTED GEOMETRY GOES HERE ----------
void loadYourScene() {
  buildings.clear();
  roads.clear();
  walks.clear();

  // --------------------
  // BUILDINGS (from your export)
  // --------------------
  buildings.add(new PolyShape(poly(
    new PVector(-109.60,0,-356.80),
    new PVector(-13.60,0,-356.80),
    new PVector(-13.60,0,-252.80),
    new PVector(-109.60,0,-252.80)
  ), color(185,185,185), 170.0));

  buildings.add(new PolyShape(poly(
    new PVector(-282.04,0,217.42),
    new PVector(-280.27,0,213.87),
    new PVector(-278.49,0,215.64),
    new PVector(-168.27,0,194.31),
    new PVector(-143.38,0,176.53),
    new PVector(-148.71,0,100.09),
    new PVector(-210.93,0,100.09),
    new PVector(-239.38,0,52.09),
    new PVector(-319.38,0,62.76),
    new PVector(-282.04,0,210.31)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(-182.49,0,48.53),
    new PVector(-180.71,0,50.31),
    new PVector(-178.93,0,50.31),
    new PVector(-164.71,0,76.98),
    new PVector(-145.16,0,73.42),
    new PVector(-127.38,0,85.87),
    new PVector(-38.49,0,21.87),
    new PVector(14.84,0,87.64),
    new PVector(78.84,0,48.53),
    new PVector(-2.93,0,-68.80),
    new PVector(-27.82,0,-52.80),
    new PVector(-49.16,0,-91.91),
    new PVector(-177.16,0,11.20),
    new PVector(-180.71,0,48.53)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(-162.93,0,263.64),
    new PVector(-148.71,0,318.76),
    new PVector(-123.82,0,316.98),
    new PVector(-118.49,0,329.42),
    new PVector(34.40,0,277.87),
    new PVector(32.62,0,260.09),
    new PVector(55.73,0,260.09),
    new PVector(36.18,0,167.64),
    new PVector(-18.93,0,180.09),
    new PVector(-31.38,0,139.20),
    new PVector(-56.27,0,121.42),
    new PVector(-104.27,0,155.20),
    new PVector(-100.71,0,169.42),
    new PVector(-134.49,0,183.64),
    new PVector(-129.16,0,212.09),
    new PVector(-162.93,0,220.98),
    new PVector(-164.71,0,265.42)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(-465.16,0,268.98),
    new PVector(-461.60,0,268.98),
    new PVector(-374.49,0,256.53),
    new PVector(-370.93,0,270.76),
    new PVector(-267.82,0,254.76),
    new PVector(-280.27,0,222.76),
    new PVector(-314.04,0,224.53),
    new PVector(-330.04,0,194.31),
    new PVector(-477.60,0,222.76),
    new PVector(-465.16,0,267.20)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(16.62,0,121.42),
    new PVector(16.62,0,124.98),
    new PVector(116.18,0,247.64),
    new PVector(141.07,0,238.76),
    new PVector(151.73,0,242.31),
    new PVector(215.73,0,197.87),
    new PVector(253.07,0,171.20),
    new PVector(297.51,0,220.98),
    new PVector(306.40,0,215.64),
    new PVector(315.29,0,224.53),
    new PVector(329.51,0,213.87),
    new PVector(338.40,0,222.76),
    new PVector(359.73,0,210.31),
    new PVector(350.84,0,196.09),
    new PVector(407.73,0,160.53),
    new PVector(413.07,0,149.87),
    new PVector(361.51,0,96.53),
    new PVector(382.84,0,87.64),
    new PVector(372.18,0,75.20),
    new PVector(389.96,0,62.76),
    new PVector(372.18,0,37.87),
    new PVector(448.62,0,-13.69),
    new PVector(409.51,0,-139.91),
    new PVector(400.62,0,-141.69),
    new PVector(165.96,0,41.42),
    new PVector(217.51,0,105.42),
    new PVector(149.96,0,162.31),
    new PVector(71.73,0,80.53),
    new PVector(18.40,0,117.87)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(25.51,0,-99.02),
    new PVector(30.84,0,-86.58),
    new PVector(77.07,0,-15.47),
    new PVector(112.62,0,-33.24),
    new PVector(130.40,0,-15.47),
    new PVector(158.84,0,-33.24),
    new PVector(103.73,0,-118.58),
    new PVector(75.29,0,-100.80),
    new PVector(66.40,0,-113.24),
    new PVector(32.62,0,-97.24),
    new PVector(27.29,0,-93.69)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(100.18,0,-132.80),
    new PVector(103.73,0,-129.24),
    new PVector(133.96,0,-91.91),
    new PVector(181.96,0,-131.02),
    new PVector(155.29,0,-177.24),
    new PVector(112.62,0,-150.58),
    new PVector(98.40,0,-129.24)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(-50.93,0,-243.02),
    new PVector(-54.49,0,-234.13),
    new PVector(30.84,0,-299.91),
    new PVector(14.84,0,-319.47),
    new PVector(27.29,0,-326.58),
    new PVector(-22.49,0,-383.47),
    new PVector(-116.71,0,-308.80),
    new PVector(-52.71,0,-239.47)
  ), color(190,170,140), 120.0));

  buildings.add(new PolyShape(poly(
    new PVector(-219.82,0,-104.36),
    new PVector(-218.04,0,-100.80),
    new PVector(-114.93,0,-184.36),
    new PVector(-180.71,0,-271.47),
    new PVector(-290.93,0,-177.24),
    new PVector(-221.60,0,-102.58)
  ), color(190,170,140), 120.0));

  // --------------------
  // ROADS
  // --------------------
  roads.add(new PolyShape(poly(
    new PVector(154.40,0,-404.80),
    new PVector(258.40,0,-404.80),
    new PVector(258.40,0,123.20),
    new PVector(154.40,0,123.20)
  ), color(110), 2.0));

  roads.add(new PolyShape(poly(
    new PVector(-456.27,0,409.42),
    new PVector(-450.93,0,402.31),
    new PVector(-454.49,0,395.20),
    new PVector(-266.04,0,366.76),
    new PVector(-255.38,0,345.42),
    new PVector(-257.16,0,315.20),
    new PVector(-246.49,0,318.76),
    new PVector(-255.38,0,377.42),
    new PVector(-290.93,0,388.09),
    new PVector(-513.16,0,452.09)
  ), color(110), 2.0));

  roads.add(new PolyShape(poly(
    new PVector(-349.60,0,450.31),
    new PVector(-354.93,0,452.09),
    new PVector(-276.71,0,436.09),
    new PVector(-246.49,0,448.53),
    new PVector(-200.27,0,443.20),
    new PVector(-164.71,0,416.53),
    new PVector(317.07,0,297.42),
    new PVector(521.51,0,311.64),
    new PVector(525.07,0,268.98),
    new PVector(501.96,0,249.42),
    new PVector(510.84,0,130.31),
    new PVector(512.62,0,21.87),
    new PVector(493.07,0,-40.36),
    new PVector(523.29,0,-43.91),
    new PVector(436.18,0,-278.58),
    new PVector(388.18,0,-259.02),
    new PVector(352.62,0,-317.69),
    new PVector(322.40,0,-363.91),
    new PVector(281.51,0,-388.80),
    new PVector(171.29,0,-451.02),
    new PVector(130.40,0,-449.24),
    new PVector(119.73,0,-431.47),
    new PVector(107.29,0,-438.58),
    new PVector(55.73,0,-397.69),
    new PVector(30.84,0,-415.47),
    new PVector(9.51,0,-397.69),
    new PVector(34.40,0,-358.58),
    new PVector(62.84,0,-365.69),
    new PVector(117.96,0,-404.80),
    new PVector(162.40,0,-411.91),
    new PVector(240.62,0,-378.13),
    new PVector(320.62,0,-328.36),
    new PVector(365.07,0,-264.36),
    new PVector(386.40,0,-209.24),
    new PVector(482.40,0,11.20),
    new PVector(475.29,0,30.76),
    new PVector(459.29,0,32.53),
    new PVector(461.07,0,4.09),
    new PVector(446.84,0,-10.13),
    new PVector(389.96,0,34.31),
    new PVector(377.51,0,48.53),
    new PVector(386.40,0,62.76),
    new PVector(368.62,0,92.98),
    new PVector(418.40,0,148.09),
    new PVector(466.40,0,119.64),
    new PVector(464.62,0,75.20),
    new PVector(471.73,0,59.20),
    new PVector(484.18,0,59.20),
    new PVector(491.29,0,69.87),
    new PVector(498.40,0,80.53),
    new PVector(498.40,0,110.76),
    new PVector(491.29,0,165.87),
    new PVector(478.84,0,254.76),
    new PVector(455.73,0,265.42),
    new PVector(437.96,0,256.53),
    new PVector(384.62,0,249.42),
    new PVector(341.96,0,260.09),
    new PVector(270.84,0,263.64),
    new PVector(75.29,0,302.76),
    new PVector(-198.49,0,373.87),
    new PVector(-219.82,0,357.87),
    new PVector(-218.04,0,313.42),
    new PVector(-207.38,0,297.42),
    new PVector(-189.60,0,297.42),
    new PVector(-180.71,0,324.09),
    new PVector(-148.71,0,318.76),
    new PVector(-162.93,0,276.09),
    new PVector(-189.60,0,258.31),
    new PVector(-207.38,0,265.42),
    new PVector(-218.04,0,236.98),
    new PVector(-168.27,0,233.42),
    new PVector(-129.16,0,197.87),
    new PVector(-66.93,0,151.64),
    new PVector(-81.16,0,135.64),
    new PVector(-166.49,0,197.87),
    new PVector(-216.27,0,224.53),
    new PVector(-282.04,0,235.20),
    new PVector(-294.49,0,238.76),
    new PVector(-285.60,0,277.87),
    new PVector(-472.27,0,318.76),
    new PVector(-456.27,0,393.42),
    new PVector(-273.16,0,366.76),
    new PVector(-274.93,0,316.98),
    new PVector(-258.93,0,308.09)
  ), color(110), 2.0));

  // --------------------
  // WALKWAYS
  // --------------------
  walks.add(new PolyShape(poly(
    new PVector(-109.60,0,-172.80),
    new PVector(82.40,0,-172.80),
    new PVector(82.40,0,-36.80),
    new PVector(-109.60,0,-36.80)
  ), color(245), 2.0));

  walks.add(new PolyShape(poly(
    new PVector(245.96,0,251.20),
    new PVector(254.84,0,254.76),
    new PVector(94.84,0,73.42),
    new PVector(18.40,0,123.20),
    new PVector(7.73,0,126.76),
    new PVector(9.51,0,171.20),
    new PVector(-31.38,0,181.87),
    new PVector(-58.04,0,132.09),
    new PVector(-106.04,0,151.64),
    new PVector(-122.04,0,117.87),
    new PVector(-127.38,0,82.31),
    new PVector(-38.49,0,21.87),
    new PVector(2.40,0,80.53),
    new PVector(32.62,0,76.98),
    new PVector(77.07,0,46.76),
    new PVector(0.62,0,-54.58),
    new PVector(-8.27,0,-68.80),
    new PVector(-90.04,0,-52.80)
  ), color(245), 2.0));
}
