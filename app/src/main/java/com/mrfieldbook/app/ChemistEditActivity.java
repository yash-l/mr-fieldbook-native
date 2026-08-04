package com.mrfieldbook.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Locale;

public class ChemistEditActivity extends Activity {
    private Db db;
    private long chemistId;
    private Models.Chemist chemist;
    private EditText name, address, notes;
    private Button gps;
    private double lat, lng;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        db = new Db(this);
        chemistId = getIntent().getLongExtra("chemist_id", 0);
        chemist = chemistId > 0 ? db.getChemist(chemistId) : null;
        build();
    }

    private void build() {
        LinearLayout root = Ui.vertical(this);
        root.setBackgroundColor(Ui.BG);

        LinearLayout head = Ui.horizontal(this);
        head.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 16), Ui.dp(this, 8));
        Button back = Ui.ghost(this, "‹ Back");
        back.setOnClickListener(v -> finish());
        head.addView(back);
        TextView title = Ui.title(this, chemist == null ? "Add chemist" : "Edit chemist");
        LinearLayout.LayoutParams titleParams = Ui.weight(1);
        titleParams.setMargins(Ui.dp(this, 12), 0, 0, 0);
        head.addView(title, titleParams);
        root.addView(head, Ui.matchWrap(this));

        ScrollView scroll = new ScrollView(this);
        LinearLayout form = Ui.vertical(this);
        form.setPadding(Ui.dp(this, 16), Ui.dp(this, 8), Ui.dp(this, 16), Ui.dp(this, 30));
        scroll.addView(form);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);

        form.addView(Ui.label(this, "Chemist name"));
        name = Ui.edit(this, "Chemist / pharmacy name");
        form.addView(name, Ui.matchWrap(this));
        Ui.spacer(form, 12);

        form.addView(Ui.label(this, "Address"));
        address = Ui.notes(this, "Chemist address");
        form.addView(address, Ui.matchWrap(this));
        Ui.spacer(form, 12);

        gps = Ui.secondary(this, "Use current GPS for chemist");
        gps.setOnClickListener(v -> fetchGps());
        form.addView(gps, Ui.matchWrap(this));
        Ui.spacer(form, 12);

        form.addView(Ui.label(this, "Notes"));
        notes = Ui.notes(this, "Optional stock, contact or availability notes");
        form.addView(notes, Ui.matchWrap(this));
        Ui.spacer(form, 18);

        Button save = Ui.button(this, "Save chemist");
        save.setOnClickListener(v -> save());
        form.addView(save, Ui.matchWrap(this));

        if (chemist != null) fill();
    }

    private void fill() {
        name.setText(chemist.name);
        address.setText(chemist.address);
        notes.setText(chemist.notes);
        lat = chemist.latitude;
        lng = chemist.longitude;
        if (lat != 0 || lng != 0) gps.setText(String.format(Locale.US, "GPS saved: %.5f, %.5f", lat, lng));
    }

    private void fetchGps() {
        gps.setText("Fetching GPS…");
        LocationHelper.fetch(this, new LocationHelper.Callback() {
            @Override public void onLocation(Location location) {
                lat = location.getLatitude();
                lng = location.getLongitude();
                gps.setText(String.format(Locale.US, "GPS: %.5f, %.5f", lat, lng));
            }
            @Override public void onError(String message) {
                gps.setText("Use current GPS for chemist");
                Ui.toast(ChemistEditActivity.this, message);
            }
        });
    }

    private void save() {
        String n = name.getText().toString().trim();
        if (n.isEmpty()) {
            name.setError("Chemist name required");
            return;
        }
        long id = db.upsertChemist(n, address.getText().toString(), lat, lng, notes.getText().toString());
        Intent result = new Intent();
        result.putExtra("chemist_id", id);
        setResult(RESULT_OK, result);
        Ui.toast(this, "Chemist saved");
        finish();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LocationHelper.REQUEST_LOCATION && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) fetchGps();
    }
}
