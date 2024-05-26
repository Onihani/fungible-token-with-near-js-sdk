import { near } from "near-sdk-js";

// helpers
import { encodeNonStringFields } from "./helpers";

// types
import {
  EVENTJSON,
  FTEventKind,
  FTBurnArgs,
  FTMintArgs,
  FTTransferEventData,
} from "./types";

export class NearEvent {
  private static toJSONString(event: EVENTJSON): string {
    return JSON.stringify(event);
  }

  private static toJSONEventString(event: EVENTJSON): string {
    return `EVENT_JSON:${this.toJSONString(event)}`;
  }

  public static emit(event: EVENTJSON): void {
    near.log(this.toJSONEventString(event));
  }
}

export class NearNep141Event {
  public static emit(eventDetails: {
    type: FTEventKind;
    data: Array<Record<string, any>>;
  }) {
    NearEvent.emit({
      standard: "nep141",
      version: "1.0.0",
      event: eventDetails.type,
      data: eventDetails.data.map((record) => encodeNonStringFields(record)),
    });
  }
}

export class FTMintEvent {
  public static emit(data: FTMintArgs) {
    this.emitMany([data]);
  }

  public static emitMany(data: Array<FTMintArgs>) {
    NearNep141Event.emit({
      type: FTEventKind.mint,
      data,
    });
  }
}

export class FTTransferEvent {
  public static emit(data: FTTransferEventData) {
    this.emitMany([data]);
  }

  public static emitMany(data: Array<FTTransferEventData & {}>) {
    NearNep141Event.emit({
      type: FTEventKind.transfer,
      data,
    });
  }
}

export class FTBurnEvent {
  public static emit(data: FTBurnArgs) {
    this.emitMany([data]);
  }

  public static emitMany(data: Array<FTBurnArgs>) {
    NearNep141Event.emit({
      type: FTEventKind.burn,
      data,
    });
  }
}
