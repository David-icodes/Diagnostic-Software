import { OutsideLab } from "../../../models/outside-lab.model";

export interface OutsideLabOption {
  id: string;
  code: string;
  name: string;
  city?: string;
}

export async function listOutsideLabs(): Promise<OutsideLabOption[]> {
  const labs = await OutsideLab.find({ active: true })
    .sort({ name: 1 })
    .select("code name city")
    .exec();
  return labs.map((lab) => ({
    id: lab.id,
    code: lab.code,
    name: lab.name,
    city: lab.city,
  }));
}