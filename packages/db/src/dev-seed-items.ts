import { and, arrayContains, eq, inArray } from "drizzle-orm";
import { createDb } from "./index";
import { collections, itemPhotos, items, users } from "./schema";

// Dev-only: fills a user's collection with fictional demo items so a full
// catalog can be reviewed before real cataloging. Every row is tagged
// "demo" so it can be removed cleanly without touching real items.
//   pnpm --filter @bitshelf/db exec tsx src/dev-seed-items.ts create <email>
//   pnpm --filter @bitshelf/db exec tsx src/dev-seed-items.ts remove <email>

type Demo = {
  category: string;
  attributes: Record<string, unknown>;
  title: string;
  conditionGrade?: number;
  storageLocation?: string;
  purchasePrice?: string;
  purchaseSource?: string;
  notes?: string;
  isFavorite?: boolean;
};

const c = (
  manufacturer: string,
  model: string,
  year: number,
  working: string,
  extra: Partial<Demo> & { variant?: string } = {},
): Demo => ({
  category: "computer",
  title: extra.variant ? `${model} (${extra.variant})` : model,
  attributes: {
    manufacturer,
    model,
    year,
    working_status: working,
    region: "NTSC",
    ...(extra.variant ? { variant: extra.variant } : {}),
  },
  ...extra,
});

const sw = (
  title: string,
  publisher: string,
  year: number,
  mediaType: string,
  extra: Partial<Demo> = {},
): Demo => ({
  category: "software",
  title: `${title} (Apple II)`,
  attributes: {
    title,
    platform: "Apple II",
    publisher,
    year,
    media_type: mediaType,
    working_status: "untested",
    completeness: extra.attributes?.completeness ?? "boxed",
    manufacturer: publisher,
    model: title,
  },
  ...extra,
});

const DEMO_ITEMS: Demo[] = [
  // Apple II line
  c("Apple", "Apple II Plus", 1979, "working", {
    conditionGrade: 3, storageLocation: "מדף A1", purchasePrice: "2400", purchaseSource: "yad2", isFavorite: true,
  }),
  c("Apple", "Apple IIe", 1983, "working", {
    conditionGrade: 4, storageLocation: "מדף A1", purchasePrice: "950", purchaseSource: "eBay",
  }),
  c("Apple", "Apple IIe", 1985, "partially_working", {
    variant: "Enhanced", conditionGrade: 3, storageLocation: "מדף A1", notes: "רעש מהספק, לבדוק קבלים",
  }),
  c("Apple", "Apple IIc Plus", 1988, "untested", {
    conditionGrade: 4, storageLocation: "מדף A2", purchasePrice: "1200", purchaseSource: "אספן פרטי",
  }),
  c("Apple", "Apple IIGS", 1986, "working", {
    variant: "Woz Edition", conditionGrade: 5, storageLocation: "מדף A2", purchasePrice: "1800", purchaseSource: "eBay", isFavorite: true,
  }),
  // Macintosh
  c("Apple", "Macintosh 128K", 1984, "not_working", {
    conditionGrade: 2, storageLocation: "מחסן", notes: "מסך לא נדלק, כנראה analog board",
  }),
  c("Apple", "Macintosh Plus", 1986, "working", {
    conditionGrade: 4, storageLocation: "מדף B1", purchasePrice: "700", purchaseSource: "פייסבוק",
  }),
  c("Apple", "Macintosh SE", 1987, "working", {
    conditionGrade: 4, storageLocation: "מדף B1",
  }),
  c("Apple", "Macintosh SE/30", 1989, "partially_working", {
    conditionGrade: 3, storageLocation: "מדף B1", notes: "simasimac, דורש recap", isFavorite: true,
  }),
  c("Apple", "Macintosh Classic", 1990, "working", {
    conditionGrade: 4, storageLocation: "מדף B2", purchasePrice: "450", purchaseSource: "yad2",
  }),
  c("Apple", "PowerBook 100", 1991, "untested", {
    conditionGrade: 3, storageLocation: "מגירה 3", notes: "בלי ספק כוח",
  }),
  // Commodore
  c("Commodore", "VIC-20", 1981, "working", {
    conditionGrade: 3, storageLocation: "מדף C1", purchasePrice: "350", purchaseSource: "eBay",
  }),
  c("Commodore", "Commodore 64", 1983, "working", {
    variant: "Breadbin", conditionGrade: 4, storageLocation: "מדף C1", isFavorite: true,
  }),
  c("Commodore", "Commodore 64C", 1986, "working", {
    conditionGrade: 4, storageLocation: "מדף C1",
  }),
  c("Commodore", "Commodore 128", 1985, "partially_working", {
    conditionGrade: 3, storageLocation: "מדף C2", notes: "מצב 128 עובד, מצב CP/M לא נבדק",
  }),
  c("Commodore", "Amiga 500", 1987, "working", {
    conditionGrade: 4, storageLocation: "מדף C2", purchasePrice: "800", purchaseSource: "אספן פרטי", isFavorite: true,
  }),
  c("Commodore", "Amiga 1200", 1992, "untested", {
    conditionGrade: 4, storageLocation: "מדף C2",
  }),
  // consoles for variety
  {
    category: "console",
    title: "Atari 2600 (Heavy Sixer)",
    attributes: { manufacturer: "Atari", model: "2600", variant: "Heavy Sixer", year: 1977, working_status: "working", region: "NTSC" },
    conditionGrade: 3, storageLocation: "מדף D1",
  },
  {
    category: "console",
    title: "Nintendo Entertainment System",
    attributes: { manufacturer: "Nintendo", model: "NES-001", year: 1986, working_status: "partially_working", region: "NTSC" },
    conditionGrade: 3, storageLocation: "מדף D1", notes: "72 pin connector דורש החלפה",
  },
  // peripherals and storage
  {
    category: "storage_device",
    title: "Disk II Drive",
    attributes: { manufacturer: "Apple", model: "Disk II", year: 1978, working_status: "working", region: "NTSC" },
    conditionGrade: 4, storageLocation: "מדף A1",
  },
  {
    category: "storage_device",
    title: "Commodore 1541",
    attributes: { manufacturer: "Commodore", model: "1541", year: 1982, working_status: "working" },
    conditionGrade: 3, storageLocation: "מדף C1",
  },
  {
    category: "peripheral",
    title: "Apple Monitor II",
    attributes: { manufacturer: "Apple", model: "Monitor II", year: 1983, working_status: "working" },
    conditionGrade: 4, storageLocation: "מדף A1",
  },
  {
    category: "peripheral",
    title: "ImageWriter II",
    attributes: { manufacturer: "Apple", model: "ImageWriter II", year: 1985, working_status: "untested" },
    conditionGrade: 3, storageLocation: "מחסן",
  },
  {
    category: "peripheral",
    title: "Apple Joystick IIe",
    attributes: { manufacturer: "Apple", model: "Joystick IIe", year: 1983, working_status: "working" },
    conditionGrade: 4, storageLocation: "מגירה 1",
  },
  {
    category: "expansion_card",
    title: "Apple Super Serial Card",
    attributes: { manufacturer: "Apple", model: "Super Serial Card", year: 1981, working_status: "untested" },
    storageLocation: "מגירה 2",
  },
  {
    category: "expansion_card",
    title: "Apple 80 Column Card",
    attributes: { manufacturer: "Apple", model: "Extended 80 Column Card", year: 1983, working_status: "working" },
    storageLocation: "מגירה 2",
  },
  // Apple II software
  sw("VisiCalc", "Personal Software", 1979, "floppy_525", {
    conditionGrade: 3, purchasePrice: "400", purchaseSource: "eBay", isFavorite: true,
  }),
  sw("AppleWorks", "Apple", 1984, "floppy_525", { conditionGrade: 4 }),
  sw("The Oregon Trail", "MECC", 1985, "floppy_525", { conditionGrade: 3 }),
  sw("Prince of Persia", "Broderbund", 1989, "floppy_35", {
    conditionGrade: 4, isFavorite: true,
  }),
  sw("Karateka", "Broderbund", 1984, "floppy_525", { conditionGrade: 3 }),
  sw("Lode Runner", "Broderbund", 1983, "floppy_525", { conditionGrade: 2 }),
  sw("Ultima IV", "Origin Systems", 1985, "floppy_525", {
    conditionGrade: 4, notes: "עם מפת בד ומטבע",
  }),
  sw("Choplifter", "Broderbund", 1982, "floppy_525", { conditionGrade: 3 }),
  // books
  {
    category: "book_manual",
    title: "Apple IIe Owner's Manual",
    attributes: { manufacturer: "Apple", model: "IIe Owner's Manual", year: 1983, working_status: "untested", completeness: "loose" },
    conditionGrade: 3, storageLocation: "מדף ספרים",
  },
  {
    category: "book_manual",
    title: "Beneath Apple DOS",
    attributes: { manufacturer: "Quality Software", model: "Beneath Apple DOS", year: 1981, working_status: "untested", completeness: "loose" },
    conditionGrade: 4, storageLocation: "מדף ספרים", isFavorite: true,
  },
];

// Public reference photos from Wikimedia Commons, each URL verified 05.09.2026.
// Demo only: real photos live in R2 once its keys are configured.
const COMMONS = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=${width}`;

const DEMO_PHOTOS: Record<string, string> = {
  "Apple II Plus": "Apple_II_Plus,_Museum_of_the_Moving_Image.jpg",
  "Apple IIe": "Apple_IIe.jpg",
  "Apple IIe (Enhanced)": "Apple_IIe.jpg",
  "Apple IIGS (Woz Edition)": "Apple_IIGS.jpg",
  "Macintosh 128K": "Macintosh_128k_transparency.png",
  "Macintosh SE": "Macintosh_SE_b.jpg",
  "Macintosh Classic": "Macintosh_Classic.jpg",
  "VIC-20": "Commodore-VIC-20-FL.jpg",
  "Commodore 64 (Breadbin)": "Commodore-64-Computer-FL.png",
  "Commodore 64C": "Commodore-64-Computer-FL.png",
  "Commodore 128": "Commodore-128.jpg",
  "Amiga 500": "Amiga500_system.jpg",
  "Amiga 1200": "Amiga_1200.jpg",
  "Atari 2600 (Heavy Sixer)": "Atari-2600-Wood-4Sw-Set.png",
  "Nintendo Entertainment System": "NES-Console-Set.png",
  "VisiCalc (Apple II)": "Visicalc.png",
  "Apple IIc Plus": "Apple_IIc_Plus_(front).jpg",
  "Macintosh Plus": "Macintosh_Plus_cropped.jpg",
  "Macintosh SE/30": "Apple_Macintosh_SE-30_computer_(1989)_clear_background.png",
  "PowerBook 100": "Powerbook_100_pose.jpg",
  "Disk II Drive": "Apple_IIe_+_Disk_II_drives_+_Apple_Monitor_II.JPG",
  "Commodore 1541": "Commodore_1541_white.jpg",
  "Apple Monitor II": "Apple_Monitor_II.jpg",
  "ImageWriter II": "Apple_ImageWriter_II.jpg",
  "Apple Joystick IIe": "Standard_J-665_Joystick.jpg",
  "Apple Super Serial Card": "Super-serial-03.jpg",
  // no free photo of the 80 column card, a generic Apple II card stands in
  "Apple 80 Column Card": "Super-serial-03.jpg",
  // software box art is copyrighted, generic media photos stand in
  "AppleWorks (Apple II)": "5.25-inch_floppy_disk.jpg",
  "The Oregon Trail (Apple II)": "5.25-inch_floppy_disk.jpg",
  "Karateka (Apple II)": "5.25-inch_floppy_disk.jpg",
  "Lode Runner (Apple II)": "5.25-inch_floppy_disk.jpg",
  "Ultima IV (Apple II)": "5.25-inch_floppy_disk.jpg",
  "Choplifter (Apple II)": "5.25-inch_floppy_disk.jpg",
  "Prince of Persia (Apple II)": "Floppy_disk_90mm.JPG",
};

async function main() {
  const action = process.argv[2];
  const email = process.argv[3];
  if ((action !== "create" && action !== "remove" && action !== "photos") || !email) {
    console.log("usage: tsx src/dev-seed-items.ts create|photos|remove <email>");
    process.exit(1);
  }
  const db = createDb(process.env.DATABASE_URL ?? "");

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.log(`no user with email ${email}`);
    process.exit(1);
  }

  if (action === "photos") {
    const demoRows = await db
      .select({ id: items.id, title: items.title })
      .from(items)
      .where(and(eq(items.ownerId, user.id), arrayContains(items.tags, ["demo"])));
    const withPhoto = demoRows.filter((r) => DEMO_PHOTOS[r.title]);
    if (withPhoto.length === 0) {
      console.log("no demo items matching the photo map, seed items first");
      return;
    }
    await db
      .delete(itemPhotos)
      .where(inArray(itemPhotos.itemId, withPhoto.map((r) => r.id)));
    await db.insert(itemPhotos).values(
      withPhoto.map((r) => ({
        itemId: r.id,
        url: COMMONS(DEMO_PHOTOS[r.title] as string, 1600),
        thumbUrl: COMMONS(DEMO_PHOTOS[r.title] as string, 400),
        isPrimary: true,
        sortOrder: 0,
      })),
    );
    console.log(`attached photos to ${withPhoto.length} demo items`);
    return;
  }

  if (action === "remove") {
    const removed = await db
      .delete(items)
      .where(and(eq(items.ownerId, user.id), arrayContains(items.tags, ["demo"])))
      .returning({ id: items.id });
    console.log(`removed ${removed.length} demo items`);
    return;
  }

  const collection = await db.query.collections.findFirst({
    where: eq(collections.ownerId, user.id),
  });
  if (!collection) {
    console.log("user has no collection yet, open the app once first");
    process.exit(1);
  }

  const existing = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.ownerId, user.id), arrayContains(items.tags, ["demo"])))
    .limit(1);
  if (existing.length > 0) {
    console.log("demo items already seeded, run remove first");
    return;
  }

  const now = Date.now();
  const rows = DEMO_ITEMS.map((demo, index) => ({
    ownerId: user.id,
    collectionId: collection.id,
    category: demo.category,
    title: demo.title,
    attributes: demo.attributes,
    conditionGrade: demo.conditionGrade ?? null,
    storageLocation: demo.storageLocation ?? null,
    purchasePrice: demo.purchasePrice ?? null,
    purchaseCurrency: demo.purchasePrice ? ("ILS" as const) : null,
    purchaseSource: demo.purchaseSource ?? null,
    notes: demo.notes ?? null,
    isFavorite: demo.isFavorite ?? false,
    isPrivate: true,
    tags: ["demo"],
    // spread creation times so "recently added" looks natural
    createdAt: new Date(now - (DEMO_ITEMS.length - index) * 86_400_000),
    updatedAt: new Date(now - (DEMO_ITEMS.length - index) * 86_400_000),
  }));
  await db.insert(items).values(rows);
  console.log(`seeded ${rows.length} demo items for ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
